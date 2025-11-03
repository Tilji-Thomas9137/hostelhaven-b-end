-- Test script to check room allocation for a specific student
-- Replace 'aswinmurali2026@mca.ajce.in' with your student's email

-- 1. Find the student's user profile and room information
SELECT 
    up.id as profile_id,
    up.user_id,
    up.admission_number,
    up.course,
    up.users.email,
    up.users.full_name,
    up.users.room_id as users_room_id,
    ra.id as allocation_id,
    ra.allocation_status,
    ra.room_id as allocation_room_id,
    r.room_number,
    r.floor,
    r.room_type
FROM user_profiles up
INNER JOIN users ON up.user_id = users.id
LEFT JOIN room_allocations ra ON ra.student_profile_id = up.id AND ra.allocation_status IN ('confirmed', 'active')
LEFT JOIN rooms r ON r.id = COALESCE(ra.room_id, users.room_id)
WHERE users.email = 'aswinmurali2026@mca.ajce.in';

-- 2. Check if the student has any room allocation record at all
SELECT 
    ra.*,
    r.room_number,
    r.floor
FROM room_allocations ra
LEFT JOIN user_profiles up ON ra.student_profile_id = up.id
LEFT JOIN users us ON up.user_id = us.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE us.email = 'aswinmurali2026@mca.ajce.in';

-- 3. Check user's room_id
SELECT 
    id,
    email,
    full_name,
    room_id
FROM users
WHERE email = 'aswinmurali2026@mca.ajce.in';

