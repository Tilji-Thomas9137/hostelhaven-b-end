-- Check what columns actually exist in admission_registry table
-- Run this in Supabase SQL Editor

-- Step 1: Check table structure
SELECT 'Checking admission_registry table structure...' as step;
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admission_registry'
ORDER BY ordinal_position;

-- Step 2: Check if table has any data
SELECT 'Checking if table has data...' as step;
SELECT COUNT(*) as total_records FROM admission_registry;

-- Step 3: Show sample data (if any exists)
SELECT 'Sample data from admission_registry:' as step;
SELECT * FROM admission_registry LIMIT 3;

-- Step 4: Check users table for comparison
SELECT 'Sample users data for comparison:' as step;
SELECT 
    id,
    email,
    full_name,
    username,
    linked_admission_number,
    role
FROM users 
WHERE email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1;

SELECT 'Column check completed!' as status;
