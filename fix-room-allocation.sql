-- Fix room allocation with null student_profile_id
-- This script will link the existing room allocation to the first student profile

UPDATE room_allocations 
SET student_profile_id = (
    SELECT id 
    FROM user_profiles 
    WHERE id NOT IN (
        SELECT COALESCE(student_profile_id, '00000000-0000-0000-0000-000000000000') 
        FROM room_allocations 
        WHERE student_profile_id IS NOT NULL
    )
    LIMIT 1
)
WHERE student_profile_id IS NULL;

-- Verify the fix
SELECT 
    ra.id,
    ra.student_profile_id,
    ra.room_id,
    ra.allocation_status,
    up.admission_number,
    up.user_id,
    r.room_number
FROM room_allocations ra
LEFT JOIN user_profiles up ON ra.student_profile_id = up.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE ra.allocation_status = 'confirmed';
