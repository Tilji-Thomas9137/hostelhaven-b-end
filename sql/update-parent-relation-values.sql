-- Update parent_relation field for existing students
-- Date: 2025-01-15
-- Purpose: Set default parent_relation values for existing records

-- Update existing records with null parent_relation to have a default value
-- You can customize these values based on your actual data
UPDATE admission_registry 
SET parent_relation = 'Parent'
WHERE parent_relation IS NULL;

-- Alternative: Set more specific relations based on parent names
-- Uncomment and modify these if you want more specific relations:

-- UPDATE admission_registry 
-- SET parent_relation = 'Father'
-- WHERE parent_relation IS NULL 
-- AND (parent_name ILIKE '%father%' OR parent_name ILIKE '%dad%' OR parent_name ILIKE '%papa%');

-- UPDATE admission_registry 
-- SET parent_relation = 'Mother'
-- WHERE parent_relation IS NULL 
-- AND (parent_name ILIKE '%mother%' OR parent_name ILIKE '%mom%' OR parent_name ILIKE '%mama%');

-- UPDATE admission_registry 
-- SET parent_relation = 'Guardian'
-- WHERE parent_relation IS NULL 
-- AND (parent_name ILIKE '%guardian%' OR parent_name ILIKE '%uncle%' OR parent_name ILIKE '%aunt%');

-- Verify the update
SELECT admission_number, student_name, parent_name, parent_relation 
FROM admission_registry 
ORDER BY created_at DESC 
LIMIT 10;
