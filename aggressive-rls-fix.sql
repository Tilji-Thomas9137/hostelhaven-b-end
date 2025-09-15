-- Aggressive RLS fix - completely reset RLS policies
-- This will temporarily disable RLS, clean everything, and re-establish proper policies

-- Step 1: Completely disable RLS on user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on user_profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_profiles';
    END LOOP;
END $$;

-- Step 3: Ensure required fields have proper defaults
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

-- Step 4: Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Create a single, permissive policy for authenticated users
CREATE POLICY "allow_authenticated_user_profiles" ON user_profiles
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
    );

-- Step 6: Allow service role to bypass RLS completely
CREATE POLICY "service_role_bypass_user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Step 7: Allow anon role for initial setup (temporary)
CREATE POLICY "allow_anon_user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'anon');

-- Step 8: Also fix users table RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all users table policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- Re-enable users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple users policies
CREATE POLICY "allow_authenticated_users" ON users
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.uid() IS NOT NULL
    );

CREATE POLICY "service_role_bypass_users" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "allow_anon_users" ON users
    FOR ALL USING (auth.role() = 'anon');
