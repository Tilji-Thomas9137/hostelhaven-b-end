-- Fix student data issue by ensuring proper data exists
-- Run this in Supabase SQL Editor

SELECT '--- Fixing Student Data Display Issue ---' as status;

-- 1. Ensure we have a student user
INSERT INTO users (id, email, password, role, full_name, status, phone, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'aswinmurali2026@mca.ajce.in',
    '$2a$10$hashedpassword', -- This is just a placeholder
    'student',
    'Aswin Murali',
    'available',
    '9876543210',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'aswinmurali2026@mca.ajce.in');

-- 2. Get the user ID for the student
DO $$
DECLARE
    student_user_id UUID;
BEGIN
    SELECT id INTO student_user_id FROM users WHERE email = 'aswinmurali2026@mca.ajce.in' AND role = 'student';
    
    IF student_user_id IS NOT NULL THEN
        RAISE NOTICE 'Found student user ID: %', student_user_id;
        
        -- 3. Create user profile for the student
        INSERT INTO user_profiles (
            user_id, 
            admission_number, 
            course, 
            batch_year, 
            phone_number, 
            status, 
            profile_status,
            created_at,
            updated_at
        )
        SELECT 
            student_user_id,
            '13186',
            'MCA',
            2026,
            '9876543210',
            'active',
            'completed',
            NOW(),
            NOW()
        WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = student_user_id);
        
        -- 4. Create parent information for the student
        INSERT INTO parents (
            student_id,
            parent_name,
            parent_email,
            parent_phone,
            parent_relation,
            parent_occupation,
            parent_address,
            created_at,
            updated_at
        )
        SELECT 
            student_user_id,
            'John Murali',
            'john.murali@email.com',
            '9123456789',
            'Father',
            'Engineer',
            '123 Main Street, City, State',
            NOW(),
            NOW()
        WHERE NOT EXISTS (SELECT 1 FROM parents WHERE student_id = student_user_id);
        
        RAISE NOTICE 'Student data created successfully for user ID: %', student_user_id;
    ELSE
        RAISE NOTICE 'Student user not found or not created';
    END IF;
END $$;

-- 5. Verify the data was created correctly
SELECT 'Verifying student data after fix:' as status;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.phone,
    up.admission_number,
    up.course,
    up.batch_year,
    up.phone_number,
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
WHERE u.email = 'aswinmurali2026@mca.ajce.in' AND u.role = 'student';

SELECT 'Student data fix completed!' as status;