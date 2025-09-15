-- Fix RLS policies for user_profiles table
-- This script removes conflicting policies and creates clean ones

-- First, drop all existing policies on user_profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create clean, non-conflicting policies for user_profiles
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

-- Also fix users table policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

-- Create clean policies for users table
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);
