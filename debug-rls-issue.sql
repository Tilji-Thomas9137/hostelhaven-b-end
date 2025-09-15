-- Debug RLS issue by checking current policies and data
-- This will help identify what's causing the violation

-- 1. Check current RLS policies on user_profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 2. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 3. Check current user context (run this as the authenticated user)
SELECT auth.uid(), auth.role();

-- 4. Check if there are any existing user_profiles for debugging
SELECT user_id, admission_number, course, status, profile_status, created_at
FROM user_profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check users table to see if the user exists
SELECT id, email, full_name, role, created_at
FROM users 
ORDER BY created_at DESC 
LIMIT 5;

