-- FIX PARENT LOGIN ISSUE FOR ADMISSION 13186
-- Run this in Supabase SQL Editor

-- 1) First, check current state
SELECT 'Current state check:' as step;

-- Check if parent user exists
SELECT 
    'Parent user exists:' as check,
    COUNT(*) as count,
    STRING_AGG(username, ', ') as usernames
FROM users 
WHERE linked_admission_number = '13186' 
AND role = 'parent';

-- Check admission registry
SELECT 
    'Admission registry:' as check,
    admission_number,
    student_name,
    parent_name,
    parent_email
FROM admission_registry 
WHERE admission_number = '13186';

-- 2) Create/fix parent user if missing
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
    ar.parent_email,
    ar.parent_name,
    'parent',
    'active',
    'PARENT-' || ar.admission_number,
    ar.admission_number,
    NOW(),
    NOW()
FROM admission_registry ar
WHERE ar.admission_number = '13186'
AND ar.parent_email IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM users 
    WHERE linked_admission_number = '13186' 
    AND role = 'parent'
)
ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    linked_admission_number = EXCLUDED.linked_admission_number,
    status = 'active',
    updated_at = NOW();

-- 3) Create Supabase Auth account for parent
DO $$
DECLARE
    parent_email TEXT;
    parent_auth_uid UUID;
    random_password TEXT;
BEGIN
    -- Get parent email
    SELECT ar.parent_email INTO parent_email
    FROM admission_registry ar
    WHERE ar.admission_number = '13186';
    
    IF parent_email IS NOT NULL THEN
        -- Generate random password
        random_password := 'Parent' || EXTRACT(EPOCH FROM NOW())::TEXT || '!';
        
        -- Create auth user
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
            parent_email,
            crypt(random_password, gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id INTO parent_auth_uid;
        
        -- Update users table with auth_uid
        UPDATE users 
        SET auth_uid = parent_auth_uid
        WHERE email = parent_email 
        AND role = 'parent'
        AND linked_admission_number = '13186';
        
        RAISE NOTICE 'Parent auth account created/updated for: %', parent_email;
        RAISE NOTICE 'Generated password: %', random_password;
    END IF;
END $$;

-- 4) Verify the fix
SELECT 
    'Verification:' as step,
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
    END as auth_status
FROM users u
WHERE u.linked_admission_number = '13186' 
AND u.role = 'parent';

-- 5) Test login resolution
SELECT 
    'Login test:' as step,
    'PARENT-13186' as input_username,
    u.email as resolved_email,
    u.status as user_status,
    CASE 
        WHEN u.auth_uid IS NOT NULL THEN 'CAN LOGIN'
        ELSE 'CANNOT LOGIN - NO AUTH'
    END as login_status
FROM users u
WHERE u.username = 'PARENT-13186';
