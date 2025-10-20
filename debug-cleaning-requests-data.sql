-- Quick test to check what data exists for cleaning requests
-- Run this in Supabase SQL Editor

-- Step 1: Check cleaning_requests table
SELECT 'Cleaning requests data:' as step;
SELECT 
    id,
    student_id,
    cleaning_type,
    status,
    created_at
FROM cleaning_requests
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Check users table for the student_id from cleaning requests
SELECT 'Users data for cleaning request students:' as step;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.username,
    u.linked_admission_number,
    u.role
FROM users u
WHERE u.id IN (
    SELECT DISTINCT student_id 
    FROM cleaning_requests 
    WHERE student_id IS NOT NULL
);

-- Step 3: Check admission_registry for these users
SELECT 'Admission registry data for cleaning request students:' as step;
SELECT 
    ar.admission_number,
    ar.user_id,
    ar.course,
    u.email,
    u.full_name
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
WHERE ar.user_id IN (
    SELECT DISTINCT student_id 
    FROM cleaning_requests 
    WHERE student_id IS NOT NULL
);

-- Step 4: Check if there's a mismatch between student_id and user_id
SELECT 'Checking for data linking issues:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.student_id,
    cr.cleaning_type,
    u.email as user_email,
    u.full_name as user_name,
    u.username,
    ar.admission_number,
    CASE 
        WHEN u.id IS NULL THEN '❌ User not found'
        WHEN ar.user_id IS NULL THEN '❌ No admission registry'
        WHEN ar.user_id = u.id THEN '✅ Properly linked'
        ELSE '❌ Mismatch'
    END as link_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN admission_registry ar ON cr.student_id = ar.user_id
ORDER BY cr.created_at DESC;

SELECT 'Data check completed!' as status;
