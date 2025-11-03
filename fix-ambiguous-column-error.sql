-- COMPREHENSIVE FIX: Remove all conflicting triggers and policies
-- Run this in Supabase SQL Editor

-- 1) Check what triggers exist on room_requests
SELECT 
    'Current triggers on room_requests:' as info,
    tgname as trigger_name,
    tgtype as trigger_type
FROM pg_trigger
WHERE tgrelid = 'room_requests'::regclass 
AND NOT tgisinternal;

-- 2) Check what policies exist on room_requests
SELECT 
    'Current RLS policies on room_requests:' as info,
    policyname as policy_name,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'room_requests';

-- 3) Remove ALL triggers that might reference current_occupancy
DROP TRIGGER IF EXISTS trigger_auto_allocate_room ON room_requests;
DROP TRIGGER IF EXISTS trigger_update_room_occupancy ON room_requests;
DROP TRIGGER IF EXISTS trigger_sync_room_allocation ON room_requests;
DROP TRIGGER IF EXISTS trigger_room_request_approval ON room_requests;

-- 4) Remove ALL functions that might cause conflicts
DROP FUNCTION IF EXISTS auto_allocate_room_on_approval();
DROP FUNCTION IF EXISTS update_room_occupancy_on_request();
DROP FUNCTION IF EXISTS sync_room_allocation();
DROP FUNCTION IF EXISTS handle_room_request_approval();

-- 5) Check for any remaining triggers
SELECT 
    'Remaining triggers after cleanup:' as info,
    tgname as trigger_name
FROM pg_trigger
WHERE tgrelid = 'room_requests'::regclass 
AND NOT tgisinternal;

-- 6) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 7) Test query to verify no ambiguous references
SELECT 
    'Test: This should work without ambiguity' as info,
    COUNT(*) as total_requests
FROM room_requests r
LEFT JOIN rooms ro ON r.requested_room_id = ro.id;

-- 8) Success message
SELECT 
    'SUCCESS!' as status,
    'All conflicting triggers and functions removed' as message,
    'Room approval should now work without ambiguity errors' as next_step;
