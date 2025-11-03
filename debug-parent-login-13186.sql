-- CHECK PARENT LOGIN ISSUE FOR ADMISSION 13186
-- Run this in Supabase SQL Editor

-- 1) Check if parent user exists for admission 13186
SELECT 
    'Parent user check for admission 13186:' as info,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid,
    created_at
FROM users 
WHERE linked_admission_number = '13186' 
AND role = 'parent';

-- 2) Check if parent exists with PARENT-13186 username
SELECT 
    'Parent with PARENT-13186 username:' as info,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid
FROM users 
WHERE username = 'PARENT-13186';

-- 3) Check all users related to admission 13186
SELECT 
    'All users related to admission 13186:' as info,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid,
    created_at
FROM users 
WHERE linked_admission_number = '13186' 
OR username LIKE '%13186%'
OR email LIKE '%13186%'
ORDER BY role, created_at;

-- 4) Check admission registry for student 13186
SELECT 
    'Admission registry for 13186:' as info,
    admission_number,
    student_name,
    student_email,
    parent_name,
    parent_email,
    parent_phone
FROM admission_registry 
WHERE admission_number = '13186';

-- 5) Check if parent has auth account
SELECT 
    'Auth users for parent email:' as info,
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
WHERE email IN (
    SELECT parent_email 
    FROM admission_registry 
    WHERE admission_number = '13186'
);

-- 6) Test login resolution logic
SELECT 
    'Login resolution test:' as info,
    'Input: PARENT-13186' as input,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE username = 'PARENT-13186') 
        THEN (SELECT email FROM users WHERE username = 'PARENT-13186' LIMIT 1)
        ELSE 'NOT FOUND'
    END as resolved_email;
