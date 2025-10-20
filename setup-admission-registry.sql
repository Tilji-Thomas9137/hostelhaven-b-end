-- Setup admission_registry table and populate with admission numbers
-- Run this in Supabase SQL Editor

-- Step 1: Create admission_registry table if it doesn't exist
CREATE TABLE IF NOT EXISTS admission_registry (
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

-- Step 2: Add foreign key constraint if users table exists
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
        ADD CONSTRAINT IF NOT EXISTS fk_admission_registry_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to admission_registry table';
    ELSE
        RAISE NOTICE 'Users table does not exist or missing id column, skipping foreign key constraint';
    END IF;
END $$;

-- Step 3: Check current data
SELECT 'Current users data:' as step;
SELECT 
    id,
    email,
    full_name,
    role
FROM users 
WHERE role = 'student'
ORDER BY email;

-- Step 4: Insert admission numbers for existing students
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

-- Step 5: Insert admission number for operations assistant (if needed)
INSERT INTO admission_registry (user_id, admission_number, course, batch_year, semester)
SELECT 
    u.id,
    'STAFF001',
    'STAFF',
    2024,
    '1'
FROM users u 
WHERE u.email = 'tilji0119@gmail.com' 
AND u.role = 'hostel_operations_assistant'
ON CONFLICT (user_id) DO UPDATE SET
    admission_number = EXCLUDED.admission_number,
    course = EXCLUDED.course,
    batch_year = EXCLUDED.batch_year,
    semester = EXCLUDED.semester,
    updated_at = NOW();

-- Step 6: Verify the data
SELECT 'Admission registry data:' as step;
SELECT 
    ar.id,
    ar.user_id,
    ar.admission_number,
    ar.course,
    ar.batch_year,
    u.email,
    u.full_name,
    u.role
FROM admission_registry ar
LEFT JOIN users u ON ar.user_id = u.id
ORDER BY ar.admission_number;

-- Step 7: Check cleaning requests with admission numbers
SELECT 'Cleaning requests with admission data:' as step;
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

SELECT 'Admission registry setup completed successfully!' as status;
