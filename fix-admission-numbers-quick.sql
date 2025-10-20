-- Quick check and fix for admission_registry table
-- Run this in Supabase SQL Editor

-- Step 1: Check if admission_registry table exists
SELECT 'Checking if admission_registry table exists...' as step;
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admission_registry'
ORDER BY ordinal_position;

-- Step 2: Drop and recreate admission_registry table with correct structure
DROP TABLE IF EXISTS admission_registry CASCADE;

CREATE TABLE admission_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    admission_number VARCHAR(50) NOT NULL,
    course VARCHAR(100),
    batch_year INTEGER,
    semester VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(admission_number)
);

-- Step 2.1: Add foreign key constraint if users table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        ALTER TABLE admission_registry 
        ADD CONSTRAINT fk_admission_registry_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to admission_registry table';
    ELSE
        RAISE NOTICE 'Users table does not exist or missing id column, skipping foreign key constraint';
    END IF;
END $$;

-- Step 3: Get the user ID for aswinmurali2026@mca.ajce.in
SELECT 'Getting user ID for student...' as step;
SELECT id, email, full_name, role 
FROM users 
WHERE email = 'aswinmurali2026@mca.ajce.in';

-- Step 4: Insert admission number for the student
INSERT INTO admission_registry (user_id, admission_number, course, batch_year, semester)
SELECT 
    u.id,
    '13186',
    'MCA',
    2026,
    '1'
FROM users u 
WHERE u.email = 'aswinmurali2026@mca.ajce.in' 
AND u.role = 'student'
ON CONFLICT (user_id) DO UPDATE SET
    admission_number = EXCLUDED.admission_number,
    course = EXCLUDED.course,
    batch_year = EXCLUDED.batch_year,
    semester = EXCLUDED.semester,
    updated_at = NOW();

-- Step 5: Verify the admission registry data
SELECT 'Admission registry data:' as step;
SELECT 
    ar.id,
    ar.user_id,
    ar.admission_number,
    ar.course,
    u.email,
    u.full_name,
    u.role
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
ORDER BY ar.admission_number;

-- Step 6: Check cleaning requests and their student data
SELECT 'Cleaning requests with student data:' as step;
SELECT 
    cr.id,
    cr.cleaning_type,
    cr.status,
    cr.student_id,
    u.email,
    u.full_name,
    ar.admission_number
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN admission_registry ar ON cr.student_id = ar.user_id
ORDER BY cr.created_at DESC;

SELECT 'Admission registry setup completed!' as status;
