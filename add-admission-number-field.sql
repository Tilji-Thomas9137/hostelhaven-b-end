-- Add admission_number field to users table if it doesn't exist
-- Run this in Supabase SQL Editor

-- Check if admission_number column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'admission_number'
    ) THEN
        ALTER TABLE users ADD COLUMN admission_number VARCHAR(50);
        RAISE NOTICE 'Added admission_number column to users table';
    ELSE
        RAISE NOTICE 'admission_number column already exists in users table';
    END IF;
END $$;

-- Update existing student with admission number
UPDATE users 
SET admission_number = '13186'
WHERE email = 'aswinmurali2026@mca.ajce.in' 
AND role = 'student';

-- Update operations assistant with admission number
UPDATE users 
SET admission_number = 'STAFF001'
WHERE email = 'tilji0119@gmail.com' 
AND role = 'hostel_operations_assistant';

-- Verify the updates
SELECT 
    email,
    full_name,
    role,
    admission_number
FROM users 
WHERE email IN ('aswinmurali2026@mca.ajce.in', 'tilji0119@gmail.com');

SELECT 'admission_number field setup completed' as status;
