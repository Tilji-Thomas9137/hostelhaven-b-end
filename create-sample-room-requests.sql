-- Create sample room requests for testing
-- Run this in Supabase SQL Editor

-- First, let's check if we have the necessary data
-- Check if users exist
SELECT 'Users count:' as info, COUNT(*) as count FROM users;

-- Check if rooms exist  
SELECT 'Rooms count:' as info, COUNT(*) as count FROM rooms;

-- Check current room requests
SELECT 'Room requests count:' as info, COUNT(*) as count FROM room_requests;

-- Create sample room requests if we have users and rooms
INSERT INTO room_requests (
    id,
    user_id,
    student_profile_id,
    preferred_room_type,
    special_requirements,
    urgency_level,
    status,
    created_at,
    requested_at,
    notes
)
SELECT 
    gen_random_uuid(),
    u.id,
    u.id, -- Using user_id as student_profile_id for simplicity
    'triple',
    'Requested Room: A1102 - Need ground floor room due to accessibility requirements',
    'medium',
    'pending',
    NOW(),
    NOW(),
    'Sample room request for testing'
FROM users u
WHERE u.role = 'student' OR u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Create another sample request with approved status
INSERT INTO room_requests (
    id,
    user_id,
    student_profile_id,
    preferred_room_type,
    special_requirements,
    urgency_level,
    status,
    created_at,
    requested_at,
    processed_at,
    processed_by,
    notes
)
SELECT 
    gen_random_uuid(),
    u.id,
    u.id,
    'double',
    'Requested Room: D201 - Prefer room with good ventilation',
    'low',
    'approved',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    (SELECT id FROM users WHERE role = 'hostel_operations_assistant' LIMIT 1),
    'Request approved and room allocated'
FROM users u
WHERE u.role = 'student' OR u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Create a rejected request
INSERT INTO room_requests (
    id,
    user_id,
    student_profile_id,
    preferred_room_type,
    special_requirements,
    urgency_level,
    status,
    created_at,
    requested_at,
    processed_at,
    processed_by,
    notes
)
SELECT 
    gen_random_uuid(),
    u.id,
    u.id,
    'single',
    'Requested Room: T301 - Need single occupancy room',
    'high',
    'rejected',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    (SELECT id FROM users WHERE role = 'hostel_operations_assistant' LIMIT 1),
    'Request rejected due to room unavailability'
FROM users u
WHERE u.role = 'student' OR u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Check the final count
SELECT 'Final room requests count:' as info, COUNT(*) as count FROM room_requests;

-- Show all room requests
SELECT 
    id,
    status,
    preferred_room_type,
    special_requirements,
    created_at,
    processed_at
FROM room_requests
ORDER BY created_at DESC;
