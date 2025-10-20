-- Create room allocation for the student to show complete details
-- Run this in Supabase SQL Editor

SELECT '--- Creating Room Allocation for Student ---' as status;

DO $$
DECLARE
    student_user_id UUID;
    room_id UUID;
BEGIN
    -- Get the student user ID
    SELECT id INTO student_user_id FROM users WHERE email = 'aswinmurali2026@mca.ajce.in' AND role = 'student';
    
    IF student_user_id IS NULL THEN
        RAISE NOTICE 'Student user not found!';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found student user ID: %', student_user_id;
    
    -- Check if there's an available room (let's use A1102 if it exists, or create one)
    SELECT id INTO room_id FROM rooms WHERE room_number = 'A1102' AND status = 'available' LIMIT 1;
    
    IF room_id IS NULL THEN
        -- Create a room if it doesn't exist
        INSERT INTO rooms (id, room_number, room_type, capacity, current_occupancy, floor, status, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'A1102',
            'triple',
            3,
            0,
            1,
            'available',
            NOW(),
            NOW()
        );
        SELECT id INTO room_id FROM rooms WHERE room_number = 'A1102';
        RAISE NOTICE 'Created room A1102 with ID: %', room_id;
    ELSE
        RAISE NOTICE 'Found existing room A1102 with ID: %', room_id;
    END IF;
    
    -- Create room allocation for the student
    INSERT INTO room_allocations (
        id,
        user_id,
        room_id,
        allocation_status,
        start_date,
        allocation_date,
        status,
        created_at,
        updated_at
    )
    VALUES (
        gen_random_uuid(),
        student_user_id,
        room_id,
        'confirmed',
        CURRENT_DATE,
        NOW(),
        'active',
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        room_id = EXCLUDED.room_id,
        allocation_status = EXCLUDED.allocation_status,
        start_date = EXCLUDED.start_date,
        allocation_date = EXCLUDED.allocation_date,
        status = EXCLUDED.status,
        updated_at = NOW();
    
    -- Update the user's room_id field
    UPDATE users 
    SET room_id = room_id, updated_at = NOW()
    WHERE id = student_user_id;
    
    RAISE NOTICE 'Room allocation created/updated for student: %', student_user_id;
END $$;

-- Verify the room allocation
SELECT 'Verifying room allocation:' as status;
SELECT 
    ra.id,
    ra.user_id,
    ra.room_id,
    ra.allocation_status,
    ra.start_date,
    ra.status,
    u.email,
    u.full_name,
    r.room_number,
    r.room_type,
    r.capacity,
    r.floor
FROM room_allocations ra
JOIN users u ON ra.user_id = u.id
JOIN rooms r ON ra.room_id = r.id
WHERE u.email = 'aswinmurali2026@mca.ajce.in';

SELECT 'Room allocation creation completed!' as status;
