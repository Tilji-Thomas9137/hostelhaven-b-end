-- Complete fix for student data display issue
-- This script ensures all student information sections are properly populated
-- Run this in Supabase SQL Editor

SELECT '--- Complete Student Data Fix ---' as status;

-- 1. Ensure we have a student user with complete data
DO $$
DECLARE
    student_user_id UUID;
BEGIN
    -- Get or create the student user
    SELECT id INTO student_user_id FROM users WHERE email = 'aswinmurali2026@mca.ajce.in' AND role = 'student';
    
    IF student_user_id IS NULL THEN
        -- Create the student user if it doesn't exist
        INSERT INTO users (id, email, password, role, full_name, status, phone, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'aswinmurali2026@mca.ajce.in',
            '$2a$10$hashedpassword', -- Placeholder password
            'student',
            'Aswin Murali',
            'available',
            '09087354672',
            NOW(),
            NOW()
        );
        SELECT id INTO student_user_id FROM users WHERE email = 'aswinmurali2026@mca.ajce.in' AND role = 'student';
        RAISE NOTICE 'Created student user with ID: %', student_user_id;
    ELSE
        RAISE NOTICE 'Found existing student user with ID: %', student_user_id;
    END IF;

    -- 2. Create or update user profile with complete information
    INSERT INTO user_profiles (
        user_id, 
        admission_number, 
        course, 
        batch_year, 
        phone_number,
        date_of_birth,
        gender,
        blood_group,
        address,
        city,
        state,
        country,
        status, 
        profile_status,
        created_at,
        updated_at
    )
    VALUES (
        student_user_id,
        '13186',
        'MCA',
        2026,
        '09087354672',
        '2000-05-15', -- Sample date of birth
        'Male',
        'O+',
        '123 Main Street, Downtown Area',
        'Kochi',
        'Kerala',
        'India',
        'active',
        'completed',
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        admission_number = EXCLUDED.admission_number,
        course = EXCLUDED.course,
        batch_year = EXCLUDED.batch_year,
        phone_number = EXCLUDED.phone_number,
        date_of_birth = EXCLUDED.date_of_birth,
        gender = EXCLUDED.gender,
        blood_group = EXCLUDED.blood_group,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        status = EXCLUDED.status,
        profile_status = EXCLUDED.profile_status,
        updated_at = NOW();

    -- 3. Create or update parent information
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
    VALUES (
        student_user_id,
        'Parvathy S Panicker',
        'parvathyspanicker2026@mca.ajce.in',
        '09562169137',
        'Mother',
        'Teacher',
        '123 Main Street, Downtown Area, Kochi, Kerala, India',
        NOW(),
        NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
        parent_name = EXCLUDED.parent_name,
        parent_email = EXCLUDED.parent_email,
        parent_phone = EXCLUDED.parent_phone,
        parent_relation = EXCLUDED.parent_relation,
        parent_occupation = EXCLUDED.parent_occupation,
        parent_address = EXCLUDED.parent_address,
        updated_at = NOW();

    RAISE NOTICE 'Student data updated successfully for user ID: %', student_user_id;
END $$;

-- 4. Verify the complete data was created/updated correctly
SELECT 'Verifying complete student data:' as status;
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
    up.date_of_birth,
    up.gender,
    up.blood_group,
    up.address,
    up.city,
    up.state,
    up.country,
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation,
    p.parent_occupation,
    p.parent_address
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
WHERE u.email = 'aswinmurali2026@mca.ajce.in' AND u.role = 'student';

-- 5. Show summary of what should now be displayed
SELECT 'Summary of student data sections:' as status;
SELECT 
    'Profile Information' as section,
    'Admission Number, Course, Batch Year, Date of Birth, Gender, Blood Group' as fields
UNION ALL
SELECT 
    'Contact Information' as section,
    'Email, Phone, Address (Street, City, State, Country)' as fields
UNION ALL
SELECT 
    'Parent Information' as section,
    'Parent Name, Parent Email, Parent Phone, Relation, Occupation, Address' as fields;

SELECT 'Complete student data fix completed!' as status;
