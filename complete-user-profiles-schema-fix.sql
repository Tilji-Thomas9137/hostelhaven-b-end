-- Complete user_profiles schema fix
-- This adds all missing columns and ensures the schema is complete

-- Step 1: Add missing Aadhar URL columns
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS aadhar_front_url TEXT;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS aadhar_back_url TEXT;

-- Step 2: Add pincode column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);

-- Step 3: Ensure all required fields have proper defaults
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET DEFAULT '';

ALTER TABLE user_profiles 
ALTER COLUMN course SET DEFAULT '';

-- Step 4: Update any existing NULL values
UPDATE user_profiles 
SET admission_number = COALESCE(admission_number, '') 
WHERE admission_number IS NULL;

UPDATE user_profiles 
SET course = COALESCE(course, '') 
WHERE course IS NULL;

-- Step 5: Show the updated schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 6: Show confirmation
SELECT 'User profiles schema updated successfully' as status;
SELECT 'Added columns: aadhar_front_url, aadhar_back_url, pincode' as columns_added;


