-- Simple and direct RLS fix for user_profiles
-- This temporarily disables RLS to allow profile saving, then re-enables with proper policies

-- Step 1: Temporarily disable RLS to allow data insertion
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Clean up any existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_manage_all" ON user_profiles;
DROP POLICY IF EXISTS "service_role_bypass" ON user_profiles;

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

-- Step 5: Create a single, simple policy that allows authenticated users to manage their own profiles
CREATE POLICY "authenticated_users_manage_own_profiles" ON user_profiles
    FOR ALL USING (
        auth.role() = 'authenticated' 
        AND auth.uid() = user_id
    );

-- Step 6: Allow service role to bypass RLS for backend operations
CREATE POLICY "service_role_bypass_user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Step 7: Allow admins to manage all profiles
CREATE POLICY "admins_manage_all_profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );
