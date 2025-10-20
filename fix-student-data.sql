-- Fix student data in users table to ensure full_name and username are properly set
-- Run this in Supabase SQL Editor

-- Step 1: Check current student data
SELECT 'Current student data:' as step;
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    status
FROM users 
WHERE role = 'student'
ORDER BY email;

-- Step 2: Update student data to ensure full_name and username are set
SELECT 'Updating student data...' as step;

-- Update aswinmurali2026@mca.ajce.in with proper data
UPDATE users 
SET 
    full_name = COALESCE(full_name, 'Aswin Murali'),
    username = COALESCE(username, '13186')
WHERE email = 'aswinmurali2026@mca.ajce.in' 
AND role = 'student';

-- Update any other students that might have missing data
UPDATE users 
SET 
    full_name = COALESCE(full_name, SPLIT_PART(email, '@', 1)),
    username = COALESCE(username, SPLIT_PART(email, '@', 1))
WHERE role = 'student' 
AND (full_name IS NULL OR full_name = '' OR username IS NULL OR username = '');

-- Step 3: Verify the updates
SELECT 'Verification after updates:' as step;
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    status
FROM users 
WHERE role = 'student'
ORDER BY email;

-- Step 4: Check cleaning requests and their linked student data
SELECT 'Cleaning requests with student data:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.cleaning_type,
    cr.status,
    cr.student_id,
    u.email as student_email,
    u.full_name as student_name,
    u.username as admission_number,
    u.role,
    CASE 
        WHEN u.full_name IS NOT NULL AND u.full_name != '' THEN '✅ Student name available'
        ELSE '❌ No student name'
    END as student_name_status,
    CASE 
        WHEN u.username IS NOT NULL AND u.username != '' THEN '✅ Admission number available'
        ELSE '❌ No admission number'
    END as admission_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
WHERE u.role = 'student'
ORDER BY cr.created_at DESC;

SELECT 'Student data fix completed!' as status;
