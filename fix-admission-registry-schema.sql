-- Fix admission_registry table to include student information
-- Run this in Supabase SQL Editor

-- Step 1: Check current admission_registry table structure
SELECT 'Checking current admission_registry table structure...' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admission_registry'
ORDER BY ordinal_position;

-- Step 2: Add missing student information fields
ALTER TABLE admission_registry 
ADD COLUMN IF NOT EXISTS student_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS student_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS student_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS parent_relation VARCHAR(50),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Step 3: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admission_registry_student_email ON admission_registry(student_email);
CREATE INDEX IF NOT EXISTS idx_admission_registry_status ON admission_registry(status);
CREATE INDEX IF NOT EXISTS idx_admission_registry_student_name ON admission_registry(student_name);

-- Step 4: Update existing records with student information from users table
UPDATE admission_registry 
SET 
  student_name = u.full_name,
  student_email = u.email,
  student_phone = u.phone,
  status = CASE 
    WHEN u.status = 'available' THEN 'active'
    WHEN u.status = 'inactive' THEN 'pending'
    WHEN u.status = 'suspended' THEN 'suspended'
    ELSE 'pending'
  END
FROM users u
WHERE admission_registry.user_id = u.id
AND u.role = 'student';

-- Step 5: Update parent information from parents table
UPDATE admission_registry 
SET 
  parent_name = p.parent_name,
  parent_email = p.parent_email,
  parent_phone = p.parent_phone,
  parent_relation = p.parent_relation
FROM parents p
WHERE admission_registry.user_id = p.user_id;

-- Step 6: Verify the updated structure
SELECT 'Updated admission_registry table structure:' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admission_registry'
ORDER BY ordinal_position;

-- Step 7: Show sample data
SELECT 'Sample admission_registry data:' as step;
SELECT 
  admission_number,
  student_name,
  student_email,
  student_phone,
  course,
  batch_year,
  parent_name,
  parent_email,
  parent_phone,
  parent_relation,
  status,
  created_at
FROM admission_registry 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'Admission registry schema fix completed!' as status;
