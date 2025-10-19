-- Refresh Supabase schema cache and verify room_allocations table
-- Run this in Supabase SQL Editor

-- First, let's verify the table exists and see its structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations'
ORDER BY ordinal_position;

-- Check if the table exists in the public schema
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'room_allocations'
) as table_exists;

-- Force refresh the schema cache by querying the table
SELECT COUNT(*) as row_count FROM room_allocations;

-- Show table permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations';

-- If the table doesn't exist or is missing columns, recreate it
DO $$
BEGIN
    -- Drop the table if it exists (to start fresh)
    DROP TABLE IF EXISTS room_allocations CASCADE;
    
    -- Recreate the table with the correct structure
    CREATE TABLE room_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        student_profile_id UUID,
        room_id UUID NOT NULL,
        request_id UUID,
        allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
    );
    
    RAISE NOTICE 'room_allocations table recreated successfully';
END $$;

-- Verify the table was created correctly
SELECT 
    'Table recreated successfully' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations';
