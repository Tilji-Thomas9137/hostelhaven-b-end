-- VERIFICATION QUERIES - Run these to confirm everything is working
-- Run these one by one in Supabase SQL Editor

-- 1. Verify the unique constraint exists
SELECT 
    'Unique constraint status:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'room_allocations' 
AND indexname = 'room_allocations_user_unique';

-- 2. Check current room allocations
SELECT 
    'Current allocations:' as info,
    ra.user_id,
    u.email,
    u.linked_admission_number,
    ra.room_id,
    r.room_number,
    ra.allocation_status,
    ra.start_date,
    ra.created_at
FROM room_allocations ra
JOIN users u ON ra.user_id = u.id
LEFT JOIN rooms r ON ra.room_id = r.id
ORDER BY ra.created_at DESC;

-- 3. Check room occupancy status
SELECT 
    'Room occupancy status:' as info,
    id,
    room_number,
    capacity,
    current_occupancy,
    (capacity - current_occupancy) as available_spots
FROM rooms
ORDER BY room_number;

-- 4. Test the ON CONFLICT functionality with a sample allocation
-- Replace the UUIDs with actual values from your database
-- First, let's see what students and rooms are available
SELECT 
    'Available students (no allocation):' as info,
    u.id as user_id,
    u.email,
    u.linked_admission_number
FROM users u
WHERE u.role = 'student'
AND u.id NOT IN (SELECT user_id FROM room_allocations WHERE allocation_status = 'confirmed')
LIMIT 5;

SELECT 
    'Available rooms:' as info,
    r.id as room_id,
    r.room_number,
    r.capacity,
    r.current_occupancy,
    (r.capacity - r.current_occupancy) as available_spots
FROM rooms r
WHERE r.current_occupancy < r.capacity
LIMIT 5;
