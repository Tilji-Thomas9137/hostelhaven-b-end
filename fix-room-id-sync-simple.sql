-- Simple Room ID Synchronization Fix
-- Run these queries one by one in Supabase SQL editor

-- Step 1: Check current state
SELECT 
    'Current State' as check_type,
    'Users with room_id' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NOT NULL
UNION ALL
SELECT 
    'Current State',
    'Students without room_id',
    COUNT(*)
FROM users 
WHERE room_id IS NULL
AND role = 'student';

-- Step 2: Show active room allocations
SELECT 
    'Active Allocations' as check_type,
    ra.allocation_status,
    COUNT(*) as count
FROM room_allocations ra
WHERE ra.allocation_status IN ('confirmed', 'active')
GROUP BY ra.allocation_status;

-- Step 3: Fix synchronization (run this to update users.room_id)
UPDATE users 
SET room_id = ra.room_id,
    updated_at = NOW()
FROM room_allocations ra
JOIN user_profiles up ON ra.student_profile_id = up.id
WHERE users.id = up.user_id
AND ra.allocation_status IN ('confirmed', 'active')
AND ra.room_id IS NOT NULL
AND (users.room_id IS NULL OR users.room_id != ra.room_id);

-- Step 4: Verify the fix
SELECT 
    'After Fix' as check_type,
    'Users with room_id' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NOT NULL
UNION ALL
SELECT 
    'After Fix',
    'Students without room_id',
    COUNT(*)
FROM users 
WHERE room_id IS NULL
AND role = 'student';

-- Step 5: Show sample of fixed users
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.room_id,
    r.room_number,
    r.floor,
    r.room_type
FROM users u
LEFT JOIN rooms r ON u.room_id = r.id
WHERE u.room_id IS NOT NULL
ORDER BY u.full_name
LIMIT 10;
