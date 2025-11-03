-- Check room allocations for students
-- This query will show all confirmed and active room allocations

SELECT 
    ra.id as allocation_id,
    ra.student_profile_id,
    ra.room_id,
    ra.allocation_status,
    ra.allocation_date,
    up.admission_number,
    up.user_id as student_user_id,
    users.email as student_email,
    users.full_name as student_name,
    r.room_number,
    r.floor,
    r.room_type
FROM room_allocations ra
LEFT JOIN user_profiles up ON ra.student_profile_id = up.id
LEFT JOIN users ON up.user_id = users.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE ra.allocation_status IN ('confirmed', 'active')
ORDER BY ra.created_at DESC;

