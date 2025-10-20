-- Test script to check admission registry data and linking
-- Run this in Supabase SQL Editor

-- Step 1: Check if admission_registry table exists and has data
SELECT 'Checking admission_registry table...' as step;
SELECT COUNT(*) as total_records FROM admission_registry;

-- Step 2: Show all admission registry records
SELECT 'All admission registry records:' as step;
SELECT 
    id,
    user_id,
    admission_number,
    course,
    batch_year
FROM admission_registry
ORDER BY created_at DESC;

-- Step 3: Check users table for the student
SELECT 'Users table for aswinmurali2026@mca.ajce.in:' as step;
SELECT 
    id,
    email,
    full_name,
    username,
    linked_admission_number,
    role
FROM users 
WHERE email = 'aswinmurali2026@mca.ajce.in';

-- Step 4: Check the linking between admission_registry and users
SELECT 'Checking admission_registry and users linking:' as step;
SELECT 
    ar.admission_number,
    ar.user_id as ar_user_id,
    u.id as users_id,
    u.email,
    u.full_name,
    CASE 
        WHEN ar.user_id = u.id THEN '✅ Linked'
        WHEN ar.user_id IS NULL THEN '❌ No user_id in admission_registry'
        WHEN u.id IS NULL THEN '❌ User not found'
        ELSE '❌ Mismatch'
    END as link_status
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
ORDER BY ar.admission_number;

-- Step 5: Check cleaning_requests and their student data
SELECT 'Cleaning requests with student data:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.cleaning_type,
    cr.status,
    cr.student_id,
    u.email as student_email,
    u.full_name as student_name,
    u.username,
    u.linked_admission_number,
    ar.admission_number as registry_admission_number
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN admission_registry ar ON cr.student_id = ar.user_id
ORDER BY cr.created_at DESC;

-- Step 6: Fix the linking if needed
SELECT 'Attempting to fix admission_registry linking...' as step;

-- Update admission_registry to link with users table
UPDATE admission_registry 
SET user_id = u.id
FROM users u
WHERE admission_registry.admission_number = u.username
AND admission_registry.user_id IS NULL;

-- Step 7: Verify the fix
SELECT 'Verification after fix:' as step;
SELECT 
    ar.admission_number,
    ar.user_id,
    u.email,
    u.full_name,
    CASE 
        WHEN ar.user_id = u.id THEN '✅ Now Linked'
        ELSE '❌ Still Not Linked'
    END as link_status
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
ORDER BY ar.admission_number;

SELECT 'Admission registry test completed!' as status;
