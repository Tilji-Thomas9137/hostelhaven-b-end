-- Fix user_profiles table schema to make required fields optional
-- This addresses the RLS policy violation by ensuring proper data structure

-- First, make admission_number and course nullable to avoid constraint violations
ALTER TABLE user_profiles 
ALTER COLUMN admission_number DROP NOT NULL;

ALTER TABLE user_profiles 
ALTER COLUMN course DROP NOT NULL;

-- Add default values for these fields
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET DEFAULT '';

ALTER TABLE user_profiles 
ALTER COLUMN course SET DEFAULT '';

-- Update existing records that might have NULL values
UPDATE user_profiles 
SET admission_number = COALESCE(admission_number, '') 
WHERE admission_number IS NULL;

UPDATE user_profiles 
SET course = COALESCE(course, '') 
WHERE course IS NULL;

-- Now re-apply the NOT NULL constraints with defaults
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET NOT NULL;

ALTER TABLE user_profiles 
ALTER COLUMN course SET NOT NULL;

-- Also ensure other important fields have proper defaults
ALTER TABLE user_profiles 
ALTER COLUMN status SET DEFAULT 'incomplete';

ALTER TABLE user_profiles 
ALTER COLUMN profile_status SET DEFAULT 'active';

