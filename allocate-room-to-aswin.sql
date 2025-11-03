-- Direct Room Allocation for Aswin Murali (Admission: 13186)
-- Run this in Supabase SQL Editor

-- Step 1: Find Aswin's user ID
SELECT 
    'Aswin Murali Details:' as info,
    id as user_id,
    email,
    linked_admission_number,
    role
FROM users 
WHERE linked_admission_number = '13186' 
AND role = 'student';

-- Step 2: Find Room A1102 details
SELECT 
    'Room A1102 Details:' as info,
    id as room_id,
    room_number,
    floor,
    room_type,
    capacity,
    current_occupancy,
    status
FROM rooms 
WHERE room_number = 'A1102';

-- Step 3: Check if Aswin already has a room allocation
SELECT 
    'Current Allocation Check:' as info,
    ra.id,
    ra.user_id,
    ra.room_id,
    ra.allocation_status,
    ra.start_date,
    r.room_number
FROM room_allocations ra
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE ra.user_id = (
    SELECT id FROM users WHERE linked_admission_number = '13186' AND role = 'student'
);

-- Step 4: Allocate Room A1102 to Aswin (replace with actual IDs from steps 1 & 2)
-- Replace 'STUDENT_USER_ID' and 'ROOM_ID' with actual values from above queries
INSERT INTO room_allocations (user_id, room_id, allocation_status, start_date)
VALUES (
    'STUDENT_USER_ID_HERE',  -- Replace with Aswin's user_id from step 1
    'ROOM_ID_HERE',          -- Replace with A1102's room_id from step 2
    'confirmed',
    CURRENT_DATE
)
ON CONFLICT (user_id) DO UPDATE
SET 
    room_id = EXCLUDED.room_id,
    allocation_status = 'confirmed',
    start_date = EXCLUDED.start_date,
    updated_at = NOW();

-- Step 5: Update room occupancy
UPDATE rooms 
SET current_occupancy = LEAST(capacity, current_occupancy + 1)
WHERE room_number = 'A1102';

-- Step 6: Update Aswin's user profile with room_id
UPDATE user_profiles 
SET room_id = (SELECT id FROM rooms WHERE room_number = 'A1102')
WHERE user_id = (SELECT id FROM users WHERE linked_admission_number = '13186' AND role = 'student');

-- Step 7: Verify the allocation
SELECT 
    'Final Verification:' as info,
    ra.user_id,
    u.email,
    u.linked_admission_number,
    ra.room_id,
    r.room_number,
    ra.allocation_status,
    ra.start_date
FROM room_allocations ra
JOIN users u ON ra.user_id = u.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE u.linked_admission_number = '13186';
