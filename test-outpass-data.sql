-- Test script to add sample outpass requests for testing
-- This will help verify that the outpass display is working correctly

-- First, let's check if there are any users in the system
SELECT 'Users in system:' as info;
SELECT id, full_name, email, auth_uid, role FROM users LIMIT 5;

-- Check if outpass_requests table exists and has any data
SELECT 'Current outpass requests:' as info;
SELECT COUNT(*) as total_outpass_requests FROM outpass_requests;

-- If we have users, let's add a test outpass request
-- We'll use the first student user we find
INSERT INTO outpass_requests (
    user_id,
    reason,
    destination,
    start_date,
    end_date,
    start_time,
    end_time,
    transport_mode,
    emergency_contact,
    emergency_phone,
    parent_approval,
    status
) 
SELECT 
    u.id as user_id,
    'Medical emergency - need to visit hospital' as reason,
    'City General Hospital' as destination,
    CURRENT_DATE + INTERVAL '1 day' as start_date,
    CURRENT_DATE + INTERVAL '2 days' as end_date,
    '09:00:00' as start_time,
    '18:00:00' as end_time,
    'taxi' as transport_mode,
    'Dr. Smith' as emergency_contact,
    '9876543210' as emergency_phone,
    true as parent_approval,
    'pending' as status
FROM users u 
WHERE u.role = 'student' 
LIMIT 1;

-- Add another test request with approved status
INSERT INTO outpass_requests (
    user_id,
    reason,
    destination,
    start_date,
    end_date,
    start_time,
    end_time,
    transport_mode,
    emergency_contact,
    emergency_phone,
    parent_approval,
    status,
    approved_by,
    approved_at
) 
SELECT 
    u.id as user_id,
    'Family function - cousin wedding' as reason,
    'Grand Hotel, Mumbai' as destination,
    CURRENT_DATE - INTERVAL '5 days' as start_date,
    CURRENT_DATE - INTERVAL '3 days' as end_date,
    '08:00:00' as start_time,
    '22:00:00' as end_time,
    'train' as transport_mode,
    'Aunt Mary' as emergency_contact,
    '9876543211' as emergency_phone,
    true as parent_approval,
    'approved' as status,
    admin.id as approved_by,
    CURRENT_TIMESTAMP - INTERVAL '2 days' as approved_at
FROM users u 
CROSS JOIN (SELECT id FROM users WHERE role = 'admin' LIMIT 1) admin
WHERE u.role = 'student' 
LIMIT 1;

-- Verify the data was inserted
SELECT 'After inserting test data:' as info;
SELECT COUNT(*) as total_outpass_requests FROM outpass_requests;

-- Show the test data
SELECT 
    opr.id,
    u.full_name as student_name,
    opr.reason,
    opr.destination,
    opr.status,
    opr.created_at
FROM outpass_requests opr
JOIN users u ON u.id = opr.user_id
ORDER BY opr.created_at DESC;
