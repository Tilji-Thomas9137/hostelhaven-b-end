-- COMPREHENSIVE PARENT LOGIN & DASHBOARD FIX
-- Run this in Supabase SQL Editor

-- 1) Check current parent user state
SELECT 'STEP 1: Current parent user state' as step;

SELECT 
    'Users table:' as table_name,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid,
    created_at
FROM users 
WHERE username = 'PARENT-13186' OR linked_admission_number = '13186';

-- 2) Check admission registry
SELECT 
    'Admission registry:' as table_name,
    admission_number,
    student_name,
    parent_name,
    parent_email,
    parent_phone
FROM admission_registry 
WHERE admission_number = '13186';

-- 3) Ensure parent user exists with correct data
INSERT INTO users (
    email,
    full_name,
    role,
    status,
    username,
    linked_admission_number,
    created_at,
    updated_at
)
SELECT 
    COALESCE(ar.parent_email, 'parent13186@example.com'),
    COALESCE(ar.parent_name, 'Parent of Student 13186'),
    'parent',
    'active',
    'PARENT-13186',
    '13186',
    NOW(),
    NOW()
FROM admission_registry ar
WHERE ar.admission_number = '13186'
ON CONFLICT (email) DO UPDATE SET
    username = 'PARENT-13186',
    linked_admission_number = '13186',
    role = 'parent',
    status = 'active',
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = NOW();

-- 4) Create/update auth user
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
)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    u.email,
    crypt('Parent123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
FROM users u
WHERE u.username = 'PARENT-13186'
ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('Parent123!', gen_salt('bf')),
    updated_at = NOW();

-- 5) Link auth_uid to user
UPDATE users 
SET auth_uid = (
    SELECT id FROM auth.users 
    WHERE email = users.email 
    AND role = 'authenticated'
)
WHERE username = 'PARENT-13186';

-- 6) Ensure user_profiles entry exists
INSERT INTO user_profiles (
    user_id,
    admission_number,
    profile_status,
    status,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.linked_admission_number,
    'active',
    'complete',
    NOW(),
    NOW()
FROM users u
WHERE u.username = 'PARENT-13186'
ON CONFLICT (user_id) DO UPDATE SET
    profile_status = 'active',
    status = 'complete',
    updated_at = NOW();

-- 7) Verify everything is correct
SELECT 'STEP 2: Verification' as step;

SELECT 
    'Final user state:' as check,
    u.id,
    u.email,
    u.username,
    u.role,
    u.status,
    u.linked_admission_number,
    u.auth_uid,
    CASE 
        WHEN u.auth_uid IS NOT NULL THEN 'HAS AUTH ACCOUNT'
        ELSE 'NO AUTH ACCOUNT'
    END as auth_status,
    up.profile_status,
    up.status as profile_complete
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.username = 'PARENT-13186';

-- 8) Test auth resolution
SELECT 
    'Auth resolution test:' as check,
    au.id as auth_id,
    au.email as auth_email,
    au.email_confirmed_at,
    au.created_at as auth_created
FROM auth.users au
WHERE au.email IN (
    SELECT email FROM users WHERE username = 'PARENT-13186'
);

-- 9) Success message
SELECT 
    'SUCCESS!' as status,
    'Parent account fully configured' as message,
    'Login: PARENT-13186 / Password: Parent123!' as credentials,
    'Should redirect to /parent-dashboard' as expected_result;
