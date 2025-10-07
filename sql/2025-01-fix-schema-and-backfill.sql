-- HostelHaven Schema Fix and Backfill Migration
-- This migration fixes room types, adds missing columns, and backfills data
-- Run this after ensuring your Supabase project has the base tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. FIX ROOMS TABLE SCHEMA
-- ============================================================================

-- Add missing columns to rooms table if they don't exist
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available' 
    CHECK (status IN ('available', 'partially_filled', 'full', 'maintenance'));

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'allocate', 'deallocate'
    target_table VARCHAR(50) NOT NULL,
    target_id UUID,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on audit_logs for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create pending_data_review table if it doesn't exist
CREATE TABLE IF NOT EXISTS pending_data_review (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    issue_description TEXT NOT NULL,
    original_data JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on pending_data_review
ALTER TABLE pending_data_review ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. BACKFILL ROOM DATA
-- ============================================================================

-- Function to safely update room types and capacity
CREATE OR REPLACE FUNCTION fix_room_types_and_capacity()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    new_room_type VARCHAR(20);
    new_capacity INTEGER;
BEGIN
    -- Loop through all rooms and fix their types
    FOR room_record IN 
        SELECT id, room_number, room_type, capacity 
        FROM rooms 
    LOOP
        -- Map old room types to standardized types
        CASE 
            WHEN room_record.room_type ILIKE '%single%' OR room_record.room_type ILIKE '%1%' THEN
                new_room_type := 'single';
                new_capacity := 1;
            WHEN room_record.room_type ILIKE '%double%' OR room_record.room_type ILIKE '%2%' OR room_record.room_type ILIKE '%twin%' THEN
                new_room_type := 'double';
                new_capacity := 2;
            WHEN room_record.room_type ILIKE '%triple%' OR room_record.room_type ILIKE '%3%' THEN
                new_room_type := 'triple';
                new_capacity := 3;
            ELSE
                -- If we can't determine the type, flag for review
                INSERT INTO pending_data_review (
                    table_name, 
                    record_id, 
                    issue_type, 
                    issue_description, 
                    original_data
                ) VALUES (
                    'rooms',
                    room_record.id,
                    'ambiguous_room_type',
                    'Cannot determine room type from: ' || COALESCE(room_record.room_type, 'NULL'),
                    jsonb_build_object(
                        'room_number', room_record.room_number,
                        'room_type', room_record.room_type,
                        'capacity', room_record.capacity
                    )
                );
                CONTINUE; -- Skip this room for now
        END CASE;

        -- Update the room with standardized type and capacity
        UPDATE rooms 
        SET 
            room_type = new_room_type,
            capacity = COALESCE(room_record.capacity, new_capacity)
        WHERE id = room_record.id;

        RAISE NOTICE 'Updated room % to type: %, capacity: %', room_record.room_number, new_room_type, new_capacity;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the room type fix
SELECT fix_room_types_and_capacity();

-- Drop the temporary function
DROP FUNCTION fix_room_types_and_capacity();

-- Add constraint to ensure room_type only allows valid values
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'rooms_room_type_check' 
        AND table_name = 'rooms'
    ) THEN
        ALTER TABLE rooms DROP CONSTRAINT rooms_room_type_check;
    END IF;
    
    -- Add new constraint
    ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check 
        CHECK (room_type IN ('single', 'double', 'triple'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add room_type constraint: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. BACKFILL CURRENT_OCCUPANCY FROM ROOM_ALLOCATIONS
-- ============================================================================

-- Function to recalculate current occupancy
CREATE OR REPLACE FUNCTION recalculate_room_occupancy()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    current_count INTEGER;
BEGIN
    -- Reset all occupancy counts
    UPDATE rooms SET current_occupancy = 0;
    
    -- Recalculate occupancy for each room
    FOR room_record IN 
        SELECT id, room_number FROM rooms 
    LOOP
        -- Count active allocations for this room
        SELECT COUNT(*) INTO current_count
        FROM room_allocations 
        WHERE room_id = room_record.id 
        AND allocation_status IN ('confirmed', 'active');
        
        -- Update the room's current occupancy
        UPDATE rooms 
        SET current_occupancy = current_count
        WHERE id = room_record.id;
        
        RAISE NOTICE 'Room % occupancy: %', room_record.room_number, current_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the occupancy recalculation
SELECT recalculate_room_occupancy();

-- Drop the temporary function
DROP FUNCTION recalculate_room_occupancy();

-- ============================================================================
-- 4. UPDATE ROOM STATUS BASED ON OCCUPANCY
-- ============================================================================

-- Function to update room status based on occupancy
CREATE OR REPLACE FUNCTION update_room_status()
RETURNS void AS $$
BEGIN
    UPDATE rooms 
    SET status = CASE 
        WHEN current_occupancy = 0 THEN 'available'
        WHEN current_occupancy < capacity THEN 'partially_filled'
        WHEN current_occupancy >= capacity THEN 'full'
        ELSE 'maintenance'
    END;
    
    RAISE NOTICE 'Updated room statuses based on occupancy';
END;
$$ LANGUAGE plpgsql;

-- Execute the status update
SELECT update_room_status();

-- Drop the temporary function
DROP FUNCTION update_room_status();

-- ============================================================================
-- 5. FLAG ORPHANED USER_PROFILES
-- ============================================================================

-- Function to flag user profiles with admission numbers not in admission_registry
CREATE OR REPLACE FUNCTION flag_orphaned_user_profiles()
RETURNS void AS $$
DECLARE
    profile_record RECORD;
    orphan_count INTEGER := 0;
BEGIN
    -- Find user profiles with admission numbers not in admission_registry
    FOR profile_record IN 
        SELECT up.id, up.admission_number, up.full_name
        FROM user_profiles up
        LEFT JOIN admission_registry ar ON up.admission_number = ar.admission_number
        WHERE up.admission_number IS NOT NULL 
        AND ar.admission_number IS NULL
    LOOP
        -- Insert into pending_data_review
        INSERT INTO pending_data_review (
            table_name, 
            record_id, 
            issue_type, 
            issue_description, 
            original_data
        ) VALUES (
            'user_profiles',
            profile_record.id,
            'orphaned_admission_number',
            'User profile has admission number not found in admission_registry: ' || profile_record.admission_number,
            jsonb_build_object(
                'admission_number', profile_record.admission_number,
                'full_name', profile_record.full_name
            )
        );
        
        orphan_count := orphan_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Flagged % orphaned user profiles', orphan_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the orphaned profile check
SELECT flag_orphaned_user_profiles();

-- Drop the temporary function
DROP FUNCTION flag_orphaned_user_profiles();

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for rooms table
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_capacity ON rooms(capacity);

-- Indexes for room_allocations table
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_status ON room_allocations(allocation_status);

-- ============================================================================
-- 7. FINAL VALIDATION
-- ============================================================================

-- Validate the migration results
DO $$
DECLARE
    room_count INTEGER;
    invalid_room_types INTEGER;
    pending_review_count INTEGER;
BEGIN
    -- Count total rooms
    SELECT COUNT(*) INTO room_count FROM rooms;
    
    -- Count rooms with invalid types
    SELECT COUNT(*) INTO invalid_room_types 
    FROM rooms 
    WHERE room_type NOT IN ('single', 'double', 'triple');
    
    -- Count pending reviews
    SELECT COUNT(*) INTO pending_review_count FROM pending_data_review;
    
    RAISE NOTICE '=== MIGRATION SUMMARY ===';
    RAISE NOTICE 'Total rooms: %', room_count;
    RAISE NOTICE 'Invalid room types: %', invalid_room_types;
    RAISE NOTICE 'Pending data reviews: %', pending_review_count;
    
    IF invalid_room_types > 0 THEN
        RAISE NOTICE 'WARNING: Some rooms still have invalid types. Check pending_data_review table.';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- ============================================================================
-- NOTES FOR MANUAL STEPS
-- ============================================================================

/*
MANUAL STEPS REQUIRED AFTER RUNNING THIS MIGRATION:

1. Review pending_data_review table for any issues that need manual resolution:
   SELECT * FROM pending_data_review WHERE resolved = false;

2. Update any rooms that were flagged for review:
   - Check the original_data column to see what needs to be fixed
   - Update the room_type manually based on actual room configuration
   - Mark as resolved in pending_data_review

3. Verify room allocations are correctly linked:
   - Check that room_allocations.room_id references valid rooms.id
   - Ensure allocation_status values are consistent

4. Test the system:
   - Verify room availability calculations work correctly
   - Check that room status updates properly based on occupancy
   - Ensure audit logs are being created for important actions

5. Set up RLS policies (run policies_rls.sql next)
*/
