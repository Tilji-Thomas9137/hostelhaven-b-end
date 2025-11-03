-- FIX PARENT AUTH PASSWORD ISSUE
-- Run this in Supabase SQL Editor

-- 1) Check current auth user for parent email
SELECT 
    'Current auth user:' as check,
    id,
    email,
    email_confirmed_at,
    created_at,
    encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 2) Update the password for the existing auth user
UPDATE auth.users 
SET 
    encrypted_password = crypt('Parent123!', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 3) Verify the password was updated
SELECT 
    'Password updated:' as check,
    id,
    email,
    email_confirmed_at,
    updated_at,
    encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 4) Ensure the users table is linked correctly
UPDATE users 
SET 
    auth_uid = (SELECT id FROM auth.users WHERE email = 'parvathyspanicker2026@mca.ajce.in'),
    status = 'active',
    role = 'parent',
    username = 'PARENT-13186',
    linked_admission_number = '13186',
    updated_at = NOW()
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 5) Final verification
SELECT 
    'Final verification:' as check,
    u.id as user_id,
    u.email,
    u.username,
    u.role,
    u.status,
    u.linked_admission_number,
    u.auth_uid,
    au.id as auth_id,
    au.email as auth_email,
    au.email_confirmed_at,
    CASE 
        WHEN u.auth_uid = au.id THEN 'LINKED CORRECTLY'
        ELSE 'NOT LINKED'
    END as link_status
FROM users u
LEFT JOIN auth.users au ON u.email = au.email
WHERE u.email = 'parvathyspanicker2026@mca.ajce.in';

-- 6) Test login resolution
SELECT 
    'Login test:' as check,
    'PARENT-13186' as input,
    u.email as resolved_email,
    u.role as user_role,
    u.status as user_status,
    CASE 
        WHEN u.auth_uid IS NOT NULL AND au.id IS NOT NULL THEN 'READY TO LOGIN'
        ELSE 'NOT READY'
    END as login_status
FROM users u
LEFT JOIN auth.users au ON u.auth_uid = au.id
WHERE u.username = 'PARENT-13186';

-- 7) Success message
SELECT 
    'SUCCESS!' as status,
    'Parent password updated to: Parent123!' as message,
    'Try logging in with PARENT-13186 / Parent123!' as instructions;
