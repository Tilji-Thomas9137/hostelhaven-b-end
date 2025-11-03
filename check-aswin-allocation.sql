-- Quick Check: Does Aswin already have a room allocation?
-- Run this in Supabase SQL Editor

-- Check if Aswin (Admission: 13186) already has a room allocation
SELECT 
    'Aswin Room Allocation Check:' as info,
    ra.id as allocation_id,
    ra.user_id,
    ra.room_id,
    ra.allocation_status,
    ra.start_date,
    u.email,
    u.linked_admission_number,
    r.room_number,
    r.floor,
    r.room_type
FROM room_allocations ra
JOIN users u ON ra.user_id = u.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE u.linked_admission_number = '13186' 
AND u.role = 'student';

-- If no results above, then Aswin needs room allocation
-- If results show, then allocation already exists
