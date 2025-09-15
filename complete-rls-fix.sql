-- Complete RLS fix for user_profiles table
-- This script fixes both schema issues and RLS policy conflicts

-- Step 1: Fix schema constraints
-- Make admission_number and course nullable temporarily
ALTER TABLE user_profiles 
ALTER COLUMN admission_number DROP NOT NULL;

ALTER TABLE user_profiles 
ALTER COLUMN course DROP NOT NULL;

-- Add default values
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET DEFAULT '';

ALTER TABLE user_profiles 
ALTER COLUMN course SET DEFAULT '';

-- Update existing NULL values
UPDATE user_profiles 
SET admission_number = COALESCE(admission_number, '') 
WHERE admission_number IS NULL;

UPDATE user_profiles 
SET course = COALESCE(course, '') 
WHERE course IS NULL;

-- Re-apply NOT NULL constraints
ALTER TABLE user_profiles 
ALTER COLUMN admission_number SET NOT NULL;

ALTER TABLE user_profiles 
ALTER COLUMN course SET NOT NULL;

-- Step 2: Clean up conflicting RLS policies
-- Drop all existing policies on user_profiles
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

-- Step 3: Create clean, working RLS policies
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own profile
CREATE POLICY "user_profiles_insert_own" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy 4: Users can delete their own profile
CREATE POLICY "user_profiles_delete_own" ON user_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Policy 5: Admins can view all profiles
CREATE POLICY "user_profiles_admin_select_all" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Policy 6: Admins can manage all profiles
CREATE POLICY "user_profiles_admin_manage_all" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Step 4: Also fix users table policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;

-- Create clean policies for users table
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 5: Add a policy to allow service role to bypass RLS (for backend operations)
CREATE POLICY "service_role_bypass" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_users" ON users
    FOR ALL USING (auth.role() = 'service_role');
