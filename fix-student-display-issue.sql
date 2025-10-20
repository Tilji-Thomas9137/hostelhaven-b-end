-- Comprehensive fix for student display issue in cleaning requests
-- Run this in Supabase SQL Editor

-- Step 1: Check what cleaning requests exist
SELECT 'Step 1: Cleaning requests data:' as step;
SELECT 
    id,
    student_id,
    cleaning_type,
    status,
    created_at
FROM cleaning_requests
ORDER BY created_at DESC;

-- Step 2: Check what users exist for the student_ids in cleaning requests
SELECT 'Step 2: Users data for cleaning request students:' as step;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.username,
    u.linked_admission_number,
    u.role,
    u.status
FROM users u
WHERE u.id IN (
    SELECT DISTINCT student_id 
    FROM cleaning_requests 
    WHERE student_id IS NOT NULL
);

-- Step 3: Check admission_registry data
SELECT 'Step 3: Admission registry data:' as step;
SELECT 
    ar.id,
    ar.user_id,
    ar.admission_number,
    ar.course,
    ar.batch_year,
    u.email,
    u.full_name
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
ORDER BY ar.created_at DESC;

-- Step 4: Check the exact linking between cleaning_requests, users, and admission_registry
SELECT 'Step 4: Data linking analysis:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.student_id,
    cr.cleaning_type,
    cr.status,
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_full_name,
    u.username as user_username,
    u.linked_admission_number,
    ar.admission_number as registry_admission_number,
    CASE 
        WHEN u.id IS NULL THEN '❌ User not found'
        WHEN u.full_name IS NULL OR u.full_name = '' THEN '❌ No full_name'
        WHEN ar.user_id IS NULL THEN '❌ No admission registry'
        WHEN ar.user_id = u.id THEN '✅ All data linked'
        ELSE '❌ Data mismatch'
    END as data_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN admission_registry ar ON cr.student_id = ar.user_id
ORDER BY cr.created_at DESC;

-- Step 5: Fix missing user data if needed
SELECT 'Step 5: Fixing missing user data...' as step;

-- Update users table with proper data for aswinmurali2026@mca.ajce.in if missing
UPDATE users 
SET 
    full_name = COALESCE(full_name, 'Aswin Murali'),
    username = COALESCE(username, '13186'),
    linked_admission_number = COALESCE(linked_admission_number, '13186')
WHERE email = 'aswinmurali2026@mca.ajce.in'
AND (full_name IS NULL OR full_name = '' OR username IS NULL OR linked_admission_number IS NULL);

-- Step 6: Ensure admission_registry has proper linking
SELECT 'Step 6: Fixing admission_registry linking...' as step;

-- Update admission_registry to link with users table
UPDATE admission_registry 
SET user_id = u.id
FROM users u
WHERE admission_registry.admission_number = u.username
AND admission_registry.user_id IS NULL;

-- Step 7: Final verification
SELECT 'Step 7: Final verification after fixes:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.cleaning_type,
    cr.status,
    u.full_name as student_name,
    u.username as admission_number,
    ar.admission_number as registry_admission_number,
    CASE 
        WHEN u.full_name IS NOT NULL AND u.full_name != '' THEN '✅ Student name available'
        ELSE '❌ Still no student name'
    END as student_name_status,
    CASE 
        WHEN u.username IS NOT NULL OR ar.admission_number IS NOT NULL THEN '✅ Admission number available'
        ELSE '❌ Still no admission number'
    END as admission_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN admission_registry ar ON cr.student_id = ar.user_id
ORDER BY cr.created_at DESC;

SELECT 'Student display fix completed!' as status;
