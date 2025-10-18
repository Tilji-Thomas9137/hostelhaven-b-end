-- Fix the specific foreign key constraint issue
-- Date: 2025-01-15
-- Purpose: Create the exact foreign key constraint that Supabase expects

-- First, let's check what constraints currently exist
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
WHERE 
    tc.table_name = 'room_requests'
    AND tc.constraint_type = 'FOREIGN KEY';

-- Drop the existing constraint if it exists with a different name
DO $$ 
BEGIN
    -- Drop any existing foreign key constraint on allocated_room_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'room_requests' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%allocated_room_id%'
    ) THEN
        DECLARE
            constraint_name_to_drop TEXT;
        BEGIN
            SELECT tc.constraint_name INTO constraint_name_to_drop
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'room_requests' 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'allocated_room_id';
            
            IF constraint_name_to_drop IS NOT NULL THEN
                EXECUTE 'ALTER TABLE room_requests DROP CONSTRAINT ' || constraint_name_to_drop;
            END IF;
        END;
    END IF;
END $$;

-- Create the exact foreign key constraint that Supabase expects
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_requests_allocated_room_id_fkey'
    ) THEN
        ALTER TABLE room_requests 
        ADD CONSTRAINT room_requests_allocated_room_id_fkey 
        FOREIGN KEY (allocated_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Also ensure the user_id foreign key has the correct name
DO $$ 
BEGIN
    -- Drop existing user_id constraint if it has wrong name
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'room_requests' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%user_id%'
        AND constraint_name != 'room_requests_user_id_fkey'
    ) THEN
        DECLARE
            constraint_name_to_drop TEXT;
        BEGIN
            SELECT tc.constraint_name INTO constraint_name_to_drop
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'room_requests' 
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'user_id'
                AND tc.constraint_name != 'room_requests_user_id_fkey';
            
            IF constraint_name_to_drop IS NOT NULL THEN
                EXECUTE 'ALTER TABLE room_requests DROP CONSTRAINT ' || constraint_name_to_drop;
            END IF;
        END;
    END IF;
END $$;

-- Create the user_id foreign key with correct name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_requests_user_id_fkey'
    ) THEN
        ALTER TABLE room_requests 
        ADD CONSTRAINT room_requests_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Verify the constraints were created
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
WHERE 
    tc.table_name = 'room_requests'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;
