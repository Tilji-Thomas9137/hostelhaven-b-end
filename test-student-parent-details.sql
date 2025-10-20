-- Test Student and Parent Details Display
-- Run this in Supabase SQL Editor

-- Step 1: Check if parents table exists and has the required structure
SELECT 'Step 1: Checking parents table structure...' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'parents'
ORDER BY ordinal_position;

-- Step 2: Check if user_profiles table has phone_number field
SELECT 'Step 2: Checking user_profiles table structure...' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
AND column_name IN ('phone_number', 'admission_number', 'course', 'batch_year')
ORDER BY ordinal_position;

-- Step 3: Create parents table if it doesn't exist
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    parent_name VARCHAR(255),
    parent_email VARCHAR(255),
    parent_phone VARCHAR(20),
    parent_relation VARCHAR(50),
    parent_occupation VARCHAR(100),
    parent_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id)
);

-- Step 4: Add foreign key constraint if users table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        -- Drop existing constraint if it exists
        ALTER TABLE parents DROP CONSTRAINT IF EXISTS fk_parents_student_id;
        
        -- Add foreign key constraint
        ALTER TABLE parents 
        ADD CONSTRAINT fk_parents_student_id 
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint to parents table';
    END IF;
END $$;

-- Step 5: Add phone_number column to user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN phone_number VARCHAR(20);
        RAISE NOTICE 'Added phone_number column to user_profiles table';
    ELSE
        RAISE NOTICE 'phone_number column already exists in user_profiles table';
    END IF;
END $$;

-- Step 6: Insert sample parent data for existing students
INSERT INTO parents (
    student_id,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    parent_occupation,
    parent_address
)
SELECT 
    u.id,
    'John Parent',
    'parent@example.com',
    '9876543210',
    'Father',
    'Engineer',
    '123 Parent Street, City, State'
FROM users u
WHERE u.role = 'student'
AND u.email = 'aswinmurali2026@mca.ajce.in'
ON CONFLICT (student_id) DO UPDATE SET
    parent_name = EXCLUDED.parent_name,
    parent_email = EXCLUDED.parent_email,
    parent_phone = EXCLUDED.parent_phone,
    parent_relation = EXCLUDED.parent_relation,
    parent_occupation = EXCLUDED.parent_occupation,
    parent_address = EXCLUDED.parent_address,
    updated_at = NOW();

-- Step 7: Update user_profiles with phone number for existing students
UPDATE user_profiles 
SET 
    phone_number = '9876543211',
    updated_at = NOW()
WHERE user_id IN (
    SELECT id FROM users 
    WHERE role = 'student' 
    AND email = 'aswinmurali2026@mca.ajce.in'
);

-- Step 8: Test the complete student details query
SELECT 'Step 8: Testing complete student details query...' as step;
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.username,
    u.role,
    u.status as user_status,
    
    -- Student profile information
    up.admission_number,
    up.course,
    up.batch_year,
    up.semester,
    up.phone_number as student_phone,
    
    -- Parent information
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation,
    p.parent_occupation,
    
    -- Room allocation information
    ra.allocation_status,
    r.room_number,
    r.floor,
    r.room_type
    
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
LEFT JOIN room_allocations ra ON u.id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE u.role = 'student'
ORDER BY u.created_at DESC
LIMIT 3;

-- Step 9: Test the admin_student_details_view
SELECT 'Step 9: Testing admin_student_details_view...' as step;
SELECT 
    user_id,
    full_name,
    email,
    admission_number,
    course,
    batch_year,
    student_phone,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    room_number,
    floor,
    room_type
FROM admin_student_details_view
LIMIT 3;

-- Step 10: Verify data completeness
SELECT 'Step 10: Verifying data completeness...' as step;
SELECT 
    'Total Students' as metric,
    COUNT(*) as count
FROM users 
WHERE role = 'student'
UNION ALL
SELECT 
    'Students with Profiles' as metric,
    COUNT(*) as count
FROM users u
JOIN user_profiles up ON u.id = up.user_id
WHERE u.role = 'student'
UNION ALL
SELECT 
    'Students with Parent Info' as metric,
    COUNT(*) as count
FROM users u
JOIN parents p ON u.id = p.student_id
WHERE u.role = 'student'
UNION ALL
SELECT 
    'Students with Room Allocation' as metric,
    COUNT(*) as count
FROM users u
JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.role = 'student'
AND ra.allocation_status IN ('active', 'confirmed');

-- Step 11: Show sample complete student record
SELECT 'Step 11: Sample complete student record...' as step;
SELECT 
    'Student ID: ' || u.id as student_info,
    'Name: ' || COALESCE(u.full_name, 'Not provided') as name_info,
    'Email: ' || COALESCE(u.email, 'Not provided') as email_info,
    'Phone: ' || COALESCE(up.phone_number, 'Not provided') as phone_info,
    'Admission: ' || COALESCE(up.admission_number, 'Not provided') as admission_info,
    'Course: ' || COALESCE(up.course, 'Not provided') as course_info,
    'Parent Name: ' || COALESCE(p.parent_name, 'Not provided') as parent_name_info,
    'Parent Email: ' || COALESCE(p.parent_email, 'Not provided') as parent_email_info,
    'Parent Phone: ' || COALESCE(p.parent_phone, 'Not provided') as parent_phone_info,
    'Parent Relation: ' || COALESCE(p.parent_relation, 'Not specified') as parent_relation_info,
    'Room: ' || COALESCE(r.room_number, 'Not allocated') as room_info
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
LEFT JOIN room_allocations ra ON u.id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE u.role = 'student'
AND u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1;

SELECT 'Student and Parent Details Test Completed Successfully!' as status;
