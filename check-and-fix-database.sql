-- Check and fix database issues
-- Run this in Supabase SQL Editor

-- 1. Check what tables exist and their data
SELECT 'Checking database state...' as status;

-- Check room_requests table
SELECT 
    'room_requests' as table_name,
    COUNT(*) as row_count
FROM room_requests;

-- Check rooms table
SELECT 
    'rooms' as table_name,
    COUNT(*) as row_count
FROM rooms;

-- Check users table
SELECT 
    'users' as table_name,
    COUNT(*) as row_count
FROM users;

-- Check room_allocations table
SELECT 
    'room_allocations' as table_name,
    COUNT(*) as row_count
FROM room_allocations;

-- 2. Show sample data from each table
SELECT 'Sample room_requests:' as info;
SELECT * FROM room_requests LIMIT 5;

SELECT 'Sample rooms:' as info;
SELECT * FROM rooms LIMIT 5;

SELECT 'Sample users:' as info;
SELECT * FROM users LIMIT 5;

-- 3. If tables are empty, create sample data
DO $$
BEGIN
    -- Create sample users if they don't exist
    INSERT INTO users (email, full_name, role, status, admission_number) VALUES
    ('tilji0119@gmail.com', 'THOMAS', 'hostel_operations_assistant', 'active', 'STAFF001'),
    ('aswinmurali2026@mca.ajce.in', 'Aswin Murali', 'student', 'active', '13186')
    ON CONFLICT (email) DO NOTHING;

    -- Create sample rooms if they don't exist
    INSERT INTO rooms (room_number, floor, room_type, capacity, current_occupancy, status) VALUES
    ('A1102', 1, 'single', 1, 0, 'available'),
    ('D201', 2, 'double', 2, 0, 'available'),
    ('T301', 3, 'triple', 3, 0, 'available'),
    ('S101', 1, 'single', 1, 0, 'available'),
    ('A1101', 1, 'single', 1, 0, 'available')
    ON CONFLICT (room_number) DO NOTHING;

    -- Create a sample room request
    INSERT INTO room_requests (
        user_id, 
        preferred_room_type, 
        special_requirements, 
        status, 
        notes,
        preferred_floor
    ) 
    SELECT 
        u.id,
        'single',
        'REQUESTED_ROOM_ID:' || r.id,
        'pending',
        'Requesting single room allocation',
        1
    FROM users u, rooms r 
    WHERE u.email = 'aswinmurali2026@mca.ajce.in' 
    AND r.room_number = 'A1102'
    LIMIT 1
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Sample data created successfully';
END $$;

-- 4. Verify the data was created
SELECT 'After creating sample data:' as status;

SELECT 'room_requests count:' as table_name, COUNT(*) as row_count FROM room_requests;
SELECT 'rooms count:' as table_name, COUNT(*) as row_count FROM rooms;
SELECT 'users count:' as table_name, COUNT(*) as row_count FROM users;

-- Show the created room request
SELECT 'Created room request:' as info;
SELECT id, user_id, preferred_room_type, status, special_requirements 
FROM room_requests 
WHERE status = 'pending' 
LIMIT 1;
