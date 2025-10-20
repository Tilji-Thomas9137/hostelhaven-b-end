-- Remove assigned_to column from cleaning_requests table
-- Run this in Supabase SQL Editor

-- Step 1: Check if assigned_to column exists
SELECT 'Checking for assigned_to column in cleaning_requests table...' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'cleaning_requests' 
AND column_name = 'assigned_to';

-- Step 2: Drop the assigned_to column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cleaning_requests' 
        AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE cleaning_requests DROP COLUMN assigned_to;
        RAISE NOTICE 'Dropped assigned_to column from cleaning_requests table';
    ELSE
        RAISE NOTICE 'assigned_to column does not exist in cleaning_requests table';
    END IF;
END $$;

-- Step 3: Verify the column has been removed
SELECT 'Verifying assigned_to column removal...' as status;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'cleaning_requests' 
ORDER BY ordinal_position;

-- Step 4: Show current table structure
SELECT 'Current cleaning_requests table structure:' as status;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'cleaning_requests'
ORDER BY ordinal_position;

SELECT 'assigned_to column removal completed successfully!' as status;
