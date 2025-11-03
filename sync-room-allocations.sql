-- Update existing room allocations to populate room_id in users table
-- This script syncs the room_id field in users table with existing room allocations

DO $$
DECLARE
    allocation_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting room allocation sync...';
    
    -- Update users table with room_id from active room allocations
    FOR allocation_record IN 
        SELECT DISTINCT
            ra.room_id,
            up.user_id
        FROM room_allocations ra
        JOIN user_profiles up ON ra.student_profile_id = up.id
        WHERE ra.allocation_status IN ('confirmed', 'active')
        AND ra.room_id IS NOT NULL
        AND up.user_id IS NOT NULL
    LOOP
        -- Update the user's room_id
        UPDATE users 
        SET room_id = allocation_record.room_id
        WHERE id = allocation_record.user_id
        AND (room_id IS NULL OR room_id != allocation_record.room_id);
        
        -- Check if update was successful
        IF FOUND THEN
            updated_count := updated_count + 1;
            RAISE NOTICE 'Updated user % with room_id %', allocation_record.user_id, allocation_record.room_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Room allocation sync completed. Updated % users.', updated_count;
END $$;

-- Verify the sync by showing users with room assignments
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.room_id,
    r.room_number,
    r.floor,
    r.room_type,
    ra.allocation_status,
    ra.created_at as allocation_date
FROM users u
LEFT JOIN rooms r ON u.room_id = r.id
LEFT JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.room_id IS NOT NULL
ORDER BY u.full_name;

-- Show count of users with and without room assignments
SELECT 
    'Users with room assignments' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NOT NULL
UNION ALL
SELECT 
    'Users without room assignments' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NULL;
