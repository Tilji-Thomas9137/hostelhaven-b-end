-- Test script to verify the system works for all registered students
-- Run this in Supabase SQL Editor

-- Step 1: Check all students in the system
SELECT 'All registered students:' as step;
SELECT 
    id,
    email,
    full_name,
    username,
    role,
    status,
    created_at
FROM users 
WHERE role = 'student'
ORDER BY created_at DESC;

-- Step 2: Check all cleaning requests and their student data
SELECT 'All cleaning requests with student data:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.cleaning_type,
    cr.status,
    cr.student_id,
    u.email as student_email,
    u.full_name as student_name,
    u.username as admission_number,
    u.role as user_role,
    u.status as user_status,
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
ORDER BY cr.created_at DESC;

-- Step 3: Check room allocations for students
SELECT 'Room allocations for students:' as step;
SELECT 
    ra.id as allocation_id,
    ra.user_id,
    ra.room_id,
    ra.allocation_status,
    ra.start_date,
    u.email as student_email,
    u.full_name as student_name,
    u.username as admission_number,
    r.room_number,
    r.floor,
    r.room_type
FROM room_allocations ra
LEFT JOIN users u ON ra.user_id = u.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE u.role = 'student'
ORDER BY ra.created_at DESC;

-- Step 4: Verify complete student data for cleaning requests
SELECT 'Complete verification for all students with cleaning requests:' as step;
SELECT 
    'Student Info' as info_type,
    u.email as student_email,
    u.full_name as student_name,
    u.username as admission_number,
    u.role,
    u.status,
    CASE 
        WHEN u.full_name IS NOT NULL AND u.username IS NOT NULL THEN '✅ Complete data'
        ELSE '❌ Missing data'
    END as data_completeness
FROM users u
WHERE u.role = 'student'
AND u.id IN (SELECT DISTINCT student_id FROM cleaning_requests WHERE student_id IS NOT NULL)
UNION ALL
SELECT 
    'Room Allocation' as info_type,
    u.email as student_email,
    u.full_name as student_name,
    u.username as admission_number,
    'ALLOCATED' as role,
    ra.allocation_status as status,
    CASE 
        WHEN ra.allocation_status IN ('active', 'confirmed') THEN '✅ Room allocated'
        ELSE '❌ No room allocation'
    END as data_completeness
FROM users u
LEFT JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.role = 'student'
AND u.id IN (SELECT DISTINCT student_id FROM cleaning_requests WHERE student_id IS NOT NULL);

-- Step 5: Test data for a new student (example)
SELECT 'Example: How to add a new student that will work with the system:' as step;
SELECT 
    'To add a new student, ensure the users table has:' as instruction,
    '1. role = ''student''' as requirement_1,
    '2. full_name = ''Student Full Name''' as requirement_2,
    '3. username = ''AdmissionNumber''' as requirement_3,
    '4. email = ''student@example.com''' as requirement_4,
    '5. status = ''active''' as requirement_5;

SELECT 'System verification completed!' as status;
