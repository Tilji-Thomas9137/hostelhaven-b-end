-- DIRECT PARENT AUTH FIX - CREATE NEW AUTH ACCOUNT
-- Run this in Supabase SQL Editor

-- 1) First, let's see what we have
SELECT 'Current state check:' as step;

SELECT 
    'Users table:' as table,
    id,
    email,
    username,
    role,
    status,
    auth_uid
FROM users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

SELECT 
    'Auth users:' as table,
    id,
    email,
    email_confirmed_at,
    created_at,
    encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 2) Delete the existing auth user (if any) to start fresh
DELETE FROM auth.users WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 3) Create a new auth user with the correct password
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'parvathyspanicker2026@mca.ajce.in',
    crypt('Parent123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- 4) Update the users table to link to the new auth account
UPDATE users 
SET 
    auth_uid = (SELECT id FROM auth.users WHERE email = 'parvathyspanicker2026@mca.ajce.in'),
    status = 'active',
    role = 'parent',
    username = 'PARENT-13186',
    linked_admission_number = '13186',
    updated_at = NOW()
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- 5) Verify everything is correct
SELECT 'Verification:' as step;

SELECT 
    'Users table after fix:' as table,
    u.id as user_id,
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
WHERE u.email = 'parvathyspanicker2026@mca.ajce.in';

SELECT 
    'Auth users after fix:' as table,
    au.id as auth_id,
    au.email,
    au.email_confirmed_at,
    au.created_at,
    CASE 
        WHEN au.encrypted_password IS NOT NULL THEN 'HAS PASSWORD'
        ELSE 'NO PASSWORD'
    END as password_status
FROM auth.users au
WHERE au.email = 'parvathyspanicker2026@mca.ajce.in';

-- 6) Test the link
SELECT 
    'Link test:' as test,
    u.auth_uid,
    au.id as auth_id,
    CASE 
        WHEN u.auth_uid = au.id THEN 'PERFECTLY LINKED'
        ELSE 'NOT LINKED'
    END as link_status
FROM users u
JOIN auth.users au ON u.email = au.email
WHERE u.email = 'parvathyspanicker2026@mca.ajce.in';

-- 7) Final success message
SELECT 
    'SUCCESS!' as status,
    'Fresh auth account created with password: Parent123!' as message,
    'Login credentials: PARENT-13186 / Parent123!' as credentials,
    'Should work now!' as result;
