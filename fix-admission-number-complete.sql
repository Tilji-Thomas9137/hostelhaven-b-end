-- Complete fix for admission number display issue
-- Run this in Supabase SQL Editor

-- Step 1: Check current database structure
SELECT 'Checking current users table structure...' as step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Step 2: Add admission_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'admission_number'
    ) THEN
        ALTER TABLE users ADD COLUMN admission_number VARCHAR(50);
        RAISE NOTICE 'Added admission_number column to users table';
    ELSE
        RAISE NOTICE 'admission_number column already exists in users table';
    END IF;
END $$;

-- Step 3: Check current user data
SELECT 'Current user data:' as step;
SELECT 
    id,
    email,
    full_name,
    role,
    admission_number,
    username
FROM users 
ORDER BY email;

-- Step 4: Update existing users with admission numbers
UPDATE users 
SET admission_number = '13186'
WHERE email = 'aswinmurali2026@mca.ajce.in' 
AND role = 'student';

UPDATE users 
SET admission_number = 'STAFF001'
WHERE email = 'tilji0119@gmail.com' 
AND role = 'hostel_operations_assistant';

-- Step 5: Verify the updates
SELECT 'Updated user data:' as step;
SELECT 
    email,
    full_name,
    role,
    admission_number
FROM users 
WHERE email IN ('aswinmurali2026@mca.ajce.in', 'tilji0119@gmail.com');

-- Step 6: Check cleaning requests data
SELECT 'Cleaning requests data:' as step;
SELECT 
    cr.id,
    cr.cleaning_type,
    cr.status,
    cr.student_id,
    u.email,
    u.full_name,
    u.admission_number
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
ORDER BY cr.created_at DESC;

SELECT 'Admission number fix completed successfully!' as status;
