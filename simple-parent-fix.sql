-- SIMPLE PARENT LOGIN FIX FOR 13186
-- Run this in Supabase SQL Editor

-- 1) Check what we have
SELECT 'STEP 1: Current state' as step;

SELECT 
    'Users table:' as table_name,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid
FROM users 
WHERE linked_admission_number = '13186' OR username LIKE '%13186%';

SELECT 
    'Admission registry:' as table_name,
    admission_number,
    student_name,
    parent_name,
    parent_email,
    parent_phone
FROM admission_registry 
WHERE admission_number = '13186';

-- 2) Create parent user if missing
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
    COALESCE(ar.parent_name, 'Parent of 13186'),
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
    status = 'active',
    updated_at = NOW();

-- 3) Create auth user manually
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

-- 4) Link auth_uid to user
UPDATE users 
SET auth_uid = (
    SELECT id FROM auth.users 
    WHERE email = users.email 
    AND role = 'authenticated'
)
WHERE username = 'PARENT-13186';

-- 5) Verify everything
SELECT 'STEP 2: After fix' as step;

SELECT 
    'Users table:' as table_name,
    id,
    email,
    username,
    role,
    status,
    linked_admission_number,
    auth_uid,
    CASE 
        WHEN auth_uid IS NOT NULL THEN 'HAS AUTH'
        ELSE 'NO AUTH'
    END as auth_status
FROM users 
WHERE username = 'PARENT-13186';

SELECT 
    'Auth users:' as table_name,
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
WHERE email IN (
    SELECT email FROM users WHERE username = 'PARENT-13186'
);

-- 6) Test login resolution
SELECT 
    'Login test:' as step,
    'Input: PARENT-13186' as input,
    u.email as resolved_email,
    u.status as user_status,
    CASE 
        WHEN u.auth_uid IS NOT NULL THEN 'READY TO LOGIN'
        ELSE 'NOT READY'
    END as login_ready
FROM users u
WHERE u.username = 'PARENT-13186';

-- 7) Success message
SELECT 
    'SUCCESS!' as status,
    'Parent account created with password: Parent123!' as message,
    'Try logging in with PARENT-13186 / Parent123!' as instructions;
