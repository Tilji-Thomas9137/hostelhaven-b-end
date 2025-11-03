-- COMPREHENSIVE ROOM REQUEST & ALLOCATION TEST
-- Run this in Supabase SQL Editor to test the complete system

-- Step 1: Setup - Run the main setup script first
-- File: setup-room-system.sql

-- Step 2: Test data preparation
-- Create a test student user (if not exists)
INSERT INTO users (
    id, 
    email, 
    auth_uid, 
    full_name, 
    phone_number, 
    role, 
    status, 
    username, 
    linked_admission_number,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test.student@example.com',
    'test-auth-uid-123',
    'Test Student',
    '9876543210',
    'student',
    'active',
    'TEST123',
    'TEST123',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create a test room (if not exists)
INSERT INTO rooms (
    id,
    room_number,
    floor,
    capacity,
    current_occupancy,
    status,
    room_type,
    hostel_id,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'TEST101',
    1,
    2,
    0,
    'available',
    'double',
    (SELECT id FROM hostels LIMIT 1),
    NOW(),
    NOW()
) ON CONFLICT (room_number) DO NOTHING;

-- Step 3: Test room request creation
-- This simulates what happens when a student submits a room request
WITH test_user AS (
    SELECT id FROM users WHERE email = 'test.student@example.com' LIMIT 1
),
test_room AS (
    SELECT id FROM rooms WHERE room_number = 'TEST101' LIMIT 1
)
INSERT INTO room_requests (
    user_id,
    preferred_room_type,
    preferred_floor,
    special_requirements,
    urgency_level,
    status,
    created_at,
    updated_at
)
SELECT 
    tu.id,
    'double',
    1,
    'Test request for automated testing',
    'medium',
    'pending',
    NOW(),
    NOW()
FROM test_user tu;

-- Step 4: Test room request approval and allocation
-- This simulates what happens when staff approves a request
WITH test_request AS (
    SELECT id, user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing' 
    AND status = 'pending' 
    LIMIT 1
),
test_room AS (
    SELECT id FROM rooms WHERE room_number = 'TEST101' LIMIT 1
),
test_staff AS (
    SELECT id FROM users WHERE role = 'admin' LIMIT 1
)
UPDATE room_requests 
SET 
    status = 'approved',
    processed_at = NOW(),
    processed_by = (SELECT id FROM test_staff),
    notes = 'Automated test approval',
    updated_at = NOW()
WHERE id = (SELECT id FROM test_request);

-- Step 5: Test room allocation creation
WITH test_request AS (
    SELECT user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing' 
    AND status = 'approved' 
    LIMIT 1
),
test_room AS (
    SELECT id FROM rooms WHERE room_number = 'TEST101' LIMIT 1
)
INSERT INTO room_allocations (
    user_id,
    room_id,
    allocation_status,
    allocated_at,
    start_date,
    allocation_date,
    created_at,
    updated_at
)
SELECT 
    tr.user_id,
    tro.id,
    'confirmed',
    NOW(),
    CURRENT_DATE,
    NOW(),
    NOW(),
    NOW()
FROM test_request tr, test_room tro;

-- Step 6: Test room occupancy update
UPDATE rooms 
SET 
    current_occupancy = 1,
    status = 'partially_filled',
    updated_at = NOW()
WHERE room_number = 'TEST101';

-- Step 7: Test student profile update
WITH test_request AS (
    SELECT user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing' 
    AND status = 'approved' 
    LIMIT 1
),
test_room AS (
    SELECT id FROM rooms WHERE room_number = 'TEST101' LIMIT 1
)
UPDATE user_profiles 
SET 
    room_id = (SELECT id FROM test_room),
    updated_at = NOW()
WHERE user_id = (SELECT user_id FROM test_request);

-- Step 8: Verify the complete flow
SELECT 
    'COMPLETE ROOM REQUEST & ALLOCATION TEST RESULTS:' as test_info;

-- Check room request
SELECT 
    'Room Request:' as info,
    rr.id as request_id,
    rr.status as request_status,
    rr.preferred_room_type,
    rr.created_at as request_created,
    rr.processed_at as request_processed
FROM room_requests rr
WHERE rr.special_requirements = 'Test request for automated testing';

-- Check room allocation
SELECT 
    'Room Allocation:' as info,
    ra.id as allocation_id,
    ra.user_id,
    ra.room_id,
    ra.allocation_status,
    ra.start_date,
    ra.allocated_at
FROM room_allocations ra
JOIN room_requests rr ON ra.user_id = rr.user_id
WHERE rr.special_requirements = 'Test request for automated testing';

-- Check room status
SELECT 
    'Room Status:' as info,
    r.room_number,
    r.capacity,
    r.current_occupancy,
    r.status as room_status
FROM rooms r
WHERE r.room_number = 'TEST101';

-- Check student profile
SELECT 
    'Student Profile:' as info,
    up.user_id,
    up.room_id,
    u.email,
    u.full_name
FROM user_profiles up
JOIN users u ON up.user_id = u.id
WHERE u.email = 'test.student@example.com';

-- Step 9: Test cancellation flow
-- Cancel the request to test cleanup
WITH test_request AS (
    SELECT id, user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing' 
    AND status = 'approved' 
    LIMIT 1
)
UPDATE room_requests 
SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = (SELECT user_id FROM test_request),
    updated_at = NOW()
WHERE id = (SELECT id FROM test_request);

-- Clean up room allocation
DELETE FROM room_allocations 
WHERE user_id IN (
    SELECT user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing'
);

-- Reset room occupancy
UPDATE rooms 
SET 
    current_occupancy = 0,
    status = 'available',
    updated_at = NOW()
WHERE room_number = 'TEST101';

-- Clear student room_id
UPDATE user_profiles 
SET 
    room_id = NULL,
    updated_at = NOW()
WHERE user_id IN (
    SELECT user_id FROM room_requests 
    WHERE special_requirements = 'Test request for automated testing'
);

-- Step 10: Final verification
SELECT 
    'FINAL TEST RESULTS:' as info,
    'All room request and allocation operations completed successfully!' as status;

-- Clean up test data
DELETE FROM room_requests 
WHERE special_requirements = 'Test request for automated testing';

-- Optional: Clean up test user and room
-- DELETE FROM users WHERE email = 'test.student@example.com';
-- DELETE FROM rooms WHERE room_number = 'TEST101';
