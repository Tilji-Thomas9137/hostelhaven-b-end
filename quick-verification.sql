-- QUICK VERIFICATION: Room Allocation on Approval
-- Run this in Supabase SQL Editor to check current status

-- Step 1: Check if unique constraint exists (required for upsert to work)
SELECT 
    'Unique Constraint Check:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'room_allocations' 
            AND indexname = 'room_allocations_user_unique'
        ) THEN '✅ EXISTS - Upsert will work'
        ELSE '❌ MISSING - Need to create constraint'
    END as status;

-- Step 2: Show current room requests
SELECT 
    'Current Room Requests:' as info,
    id,
    user_id,
    status,
    created_at
FROM room_requests
ORDER BY created_at DESC
LIMIT 5;

-- Step 3: Show current room allocations
SELECT 
    'Current Room Allocations:' as info,
    user_id,
    room_id,
    allocation_status,
    start_date,
    allocated_at
FROM room_allocations
ORDER BY allocated_at DESC
LIMIT 5;

-- Step 4: Find students with approved requests but no allocations
SELECT 
    'Students with approved requests but NO allocations:' as info,
    rr.id as request_id,
    rr.user_id,
    u.email,
    u.linked_admission_number,
    rr.status as request_status
FROM room_requests rr
JOIN users u ON rr.user_id = u.id
LEFT JOIN room_allocations ra ON rr.user_id = ra.user_id
WHERE rr.status = 'approved'
AND ra.id IS NULL;

-- Step 5: If constraint is missing, create it
-- Uncomment the line below if Step 1 shows "MISSING"
-- CREATE UNIQUE INDEX IF NOT EXISTS room_allocations_user_unique ON room_allocations (user_id);
