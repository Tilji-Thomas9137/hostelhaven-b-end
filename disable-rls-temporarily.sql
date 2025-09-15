-- Temporarily disable RLS to test profile saving
-- This will help identify if RLS is the root cause

-- Disable RLS on user_profiles table
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on users table  
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean up
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop user_profiles policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_profiles';
    END LOOP;
    
    -- Drop users policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- Ensure required fields have defaults
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET DEFAULT '';

ALTER TABLE user_profiles 
ALTER COLUMN course SET DEFAULT '';

-- Update any existing NULL values
UPDATE user_profiles 
SET admission_number = COALESCE(admission_number, '') 
WHERE admission_number IS NULL;

UPDATE user_profiles 
SET course = COALESCE(course, '') 
WHERE course IS NULL;

-- Show current state
SELECT 'RLS disabled on user_profiles and users tables' as status;
SELECT 'You can now test profile saving without RLS restrictions' as next_step;
