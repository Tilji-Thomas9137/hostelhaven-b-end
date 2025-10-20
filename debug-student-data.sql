-- Debug script to check student data in database
-- Run this in Supabase SQL Editor

SELECT '--- Debugging Student Data Issue ---' as status;

-- 1. Check if users table has student data
SELECT '1. Checking users table for student data:' as step;
SELECT 
    id, 
    email, 
    full_name, 
    role, 
    status,
    phone,
    created_at
FROM users 
WHERE role = 'student' 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check user_profiles table
SELECT '2. Checking user_profiles table:' as step;
SELECT 
    user_id,
    admission_number,
    course,
    batch_year,
    phone_number,
    status
FROM user_profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check parents table
SELECT '3. Checking parents table:' as step;
SELECT 
    student_id,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    parent_occupation
FROM parents 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Check if specific student (ID 13186) exists
SELECT '4. Checking for student with ID 13186:' as step;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.phone,
    up.admission_number,
    up.course,
    up.batch_year,
    up.phone_number,
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
WHERE u.id = '13186' OR up.admission_number = '13186' OR u.email LIKE '%13186%';

-- 5. Check all students with their profiles and parents
SELECT '5. All students with complete data:' as step;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.phone,
    up.admission_number,
    up.course,
    up.batch_year,
    up.phone_number,
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
WHERE u.role = 'student'
ORDER BY u.created_at DESC
LIMIT 5;

SELECT 'Debug completed!' as status;
