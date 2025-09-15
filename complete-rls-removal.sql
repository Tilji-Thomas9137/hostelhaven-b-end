-- Complete RLS removal and cleanup
-- This will completely remove all RLS policies and disable RLS on all tables

-- Step 1: Disable RLS on all relevant tables
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE hostels DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_waitlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_batches DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop policies for all tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Step 3: Ensure required fields have proper defaults for user_profiles
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

-- Step 4: Verify RLS is disabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    'RLS should be FALSE' as expected
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'users', 'hostels', 'rooms')
ORDER BY tablename;

-- Step 5: Show confirmation
SELECT 'RLS has been completely disabled on all tables' as status;
SELECT 'All policies have been removed' as policies_removed;
SELECT 'You can now save profiles without RLS restrictions' as next_step;


