-- TEST PARENT LOGIN FLOW
-- Run this to verify everything is set up correctly

-- 1) Check if parent user exists and is properly configured
SELECT 
    'Parent user check:' as test,
    u.id,
    u.email,
    u.username,
    u.role,
    u.status,
    u.linked_admission_number,
    u.auth_uid,
    CASE 
        WHEN u.auth_uid IS NOT NULL THEN 'HAS AUTH LINK'
        ELSE 'NO AUTH LINK'
    END as auth_status
FROM users u
WHERE u.username = 'PARENT-13186';

-- 2) Check if auth user exists and has correct password
SELECT 
    'Auth user check:' as test,
    au.id,
    au.email,
    au.email_confirmed_at,
    au.created_at,
    CASE 
        WHEN au.encrypted_password IS NOT NULL THEN 'HAS PASSWORD'
        ELSE 'NO PASSWORD'
    END as password_status
FROM auth.users au
WHERE au.email = 'parvathyspanicker2026@mca.ajce.in';

-- 3) Test the link between users and auth.users
SELECT 
    'Link test:' as test,
    u.auth_uid as user_auth_uid,
    au.id as auth_id,
    CASE 
        WHEN u.auth_uid = au.id THEN 'PERFECTLY LINKED'
        ELSE 'NOT LINKED'
    END as link_status
FROM users u
JOIN auth.users au ON u.email = au.email
WHERE u.username = 'PARENT-13186';

-- 4) Test password verification
SELECT 
    'Password test:' as test,
    email,
    CASE 
        WHEN encrypted_password = crypt('Parent123!', encrypted_password) THEN 'PASSWORD CORRECT'
        ELSE 'PASSWORD INCORRECT'
    END as password_check
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 5) Check admission registry
SELECT 
    'Admission registry:' as test,
    admission_number,
    student_name,
    parent_name,
    parent_email
FROM admission_registry 
WHERE admission_number = '13186';

-- 6) Final status
SELECT 
    'FINAL STATUS:' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE username = 'PARENT-13186' AND role = 'parent' AND status = 'active' AND auth_uid IS NOT NULL)
        AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'parvathyspanicker2026@mca.ajce.in' AND encrypted_password IS NOT NULL)
        THEN 'READY FOR LOGIN'
        ELSE 'NOT READY'
    END as login_status;
