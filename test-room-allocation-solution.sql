-- TEST SCRIPT: Verify Room Allocation Solution
-- Run this after implementing the permanent solution

-- Step 1: Check if unique constraint exists
SELECT 
    'Constraint Check:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'room_allocations' 
            AND indexname = 'room_allocations_user_unique'
        ) THEN '✅ Unique constraint exists'
        ELSE '❌ Unique constraint missing'
    END as status;

-- Step 2: Check current room requests status
SELECT 
    'Room Requests Status:' as info,
    status,
    COUNT(*) as count
FROM room_requests
GROUP BY status
ORDER BY status;

-- Step 3: Check room allocations
SELECT 
    'Room Allocations:' as info,
    allocation_status,
    COUNT(*) as count
FROM room_allocations
GROUP BY allocation_status
ORDER BY allocation_status;

-- Step 4: Find students with approved requests but no allocations
SELECT 
    'Students with approved requests but no allocations:' as info,
    rr.id as request_id,
    rr.user_id,
    u.email,
    u.linked_admission_number,
    rr.status as request_status,
    ra.id as allocation_id
FROM room_requests rr
JOIN users u ON rr.user_id = u.id
LEFT JOIN room_allocations ra ON rr.user_id = ra.user_id
WHERE rr.status = 'approved'
AND ra.id IS NULL
LIMIT 10;

-- Step 5: Test room allocation for a specific student (replace with actual IDs)
-- Uncomment and modify the query below to test allocation
/*
-- Example: Allocate room to a student with approved request
WITH student_request AS (
    SELECT user_id, room_id
    FROM room_requests 
    WHERE status = 'approved' 
    AND user_id NOT IN (SELECT user_id FROM room_allocations)
    LIMIT 1
)
INSERT INTO room_allocations (user_id, room_id, allocation_status, start_date)
SELECT user_id, room_id, 'confirmed', CURRENT_DATE
FROM student_request
ON CONFLICT (user_id) DO UPDATE
SET 
    room_id = EXCLUDED.room_id,
    allocation_status = 'confirmed',
    start_date = EXCLUDED.start_date,
    updated_at = NOW();
*/

-- Step 6: Verify the solution is working
SELECT 
    'Solution Status:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'room_allocations' 
            AND indexname = 'room_allocations_user_unique'
        ) AND EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'trigger_auto_allocate_room'
        ) THEN '✅ Permanent solution is active'
        ELSE '❌ Solution needs to be implemented'
    END as status;
