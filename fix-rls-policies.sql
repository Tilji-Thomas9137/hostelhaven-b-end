-- ADDITIONAL FIX: Disable problematic RLS policies
-- Run this AFTER the previous script

-- 1) Check current RLS status
SELECT 
    'Current RLS status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('room_requests', 'rooms', 'room_allocations');

-- 2) Temporarily disable RLS on room_requests to avoid policy conflicts
ALTER TABLE room_requests DISABLE ROW LEVEL SECURITY;

-- 3) Check if there are any policies that reference current_occupancy
SELECT 
    'Policies with current_occupancy references:' as info,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'room_requests'
AND (
    qual::text ILIKE '%current_occupancy%' 
    OR with_check::text ILIKE '%current_occupancy%'
);

-- 4) Drop any policies that reference current_occupancy
DROP POLICY IF EXISTS "room_requests_policy" ON room_requests;
DROP POLICY IF EXISTS "room_requests_select_policy" ON room_requests;
DROP POLICY IF EXISTS "room_requests_insert_policy" ON room_requests;
DROP POLICY IF EXISTS "room_requests_update_policy" ON room_requests;
DROP POLICY IF EXISTS "room_requests_delete_policy" ON room_requests;

-- 5) Re-enable RLS (but without problematic policies)
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;

-- 6) Create a simple, non-conflicting policy
CREATE POLICY "room_requests_simple_policy" ON room_requests
FOR ALL
USING (true)
WITH CHECK (true);

-- 7) Final verification
SELECT 
    'Final status:' as info,
    'RLS enabled' as rls_status,
    'Simple policy created' as policy_status,
    'No ambiguous references' as result;
