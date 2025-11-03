-- TEST PARENT LOGIN PASSWORD
-- Run this AFTER the fresh-parent-auth-fix.sql

-- Test if the password is correct by attempting to verify it
SELECT 
    'Password test:' as test,
    email,
    CASE 
        WHEN encrypted_password = crypt('Parent123!', encrypted_password) THEN 'PASSWORD CORRECT'
        ELSE 'PASSWORD INCORRECT'
    END as password_check
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- Also test with wrong password to make sure it fails
SELECT 
    'Wrong password test:' as test,
    email,
    CASE 
        WHEN encrypted_password = crypt('WrongPassword!', encrypted_password) THEN 'SHOULD NOT HAPPEN'
        ELSE 'CORRECTLY REJECTED'
    END as wrong_password_check
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';

-- Show the auth user details
SELECT 
    'Auth user details:' as info,
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    'Password: Parent123!' as password_note
FROM auth.users 
WHERE email = 'parvathyspanicker2026@mca.ajce.in';
