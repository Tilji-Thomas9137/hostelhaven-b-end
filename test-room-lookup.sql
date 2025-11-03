-- Test and fix room lookup for outpass functionality
-- Run this in Supabase SQL editor
-- Priority order: 1. user_profiles.room_id, 2. room_allocations, 3. users.room_id

-- Test the get_student_room_id function for the specific user
DO $$
DECLARE
    test_user_id UUID;
    found_room_id UUID;
BEGIN
    -- Get the user ID for the email
    SELECT id INTO test_user_id
    FROM users
    WHERE email = 'aswinmurali2026@mca.ajce.in'
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Found user ID: %', test_user_id;
        
        -- Test the room lookup function
        SELECT get_student_room_id(test_user_id) INTO found_room_id;
        
        IF found_room_id IS NOT NULL THEN
            RAISE NOTICE 'Found room ID: %', found_room_id;
            
            -- Show room details
            PERFORM r.room_number, r.floor, r.room_type, b.building_name
            FROM rooms r
            LEFT JOIN buildings b ON b.id = r.building_id
            WHERE r.id = found_room_id;
        ELSE
            RAISE NOTICE 'No room found for user';
            
            -- Check room allocations
            RAISE NOTICE 'Checking room allocations...';
            PERFORM ra.room_id, ra.allocation_status, up.admission_number
            FROM room_allocations ra
            JOIN user_profiles up ON ra.student_profile_id = up.id
            WHERE up.user_id = test_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'User not found with email: aswinmurali2026@mca.ajce.in';
    END IF;
END $$;

-- Sync room allocations to users table for better performance
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
WHERE u.email = 'aswinmurali2026@mca.ajce.in'
ORDER BY u.full_name;
