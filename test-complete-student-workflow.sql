-- Test Complete Student Workflow - From Admin Creation to Cleaning Requests
-- Run this in Supabase SQL Editor

-- Step 1: Test Admin Student Management System
SELECT 'Step 1: Testing Admin Student Management System...' as step;

-- Check if admin_student_management table exists and has data
SELECT 'Admin Student Management Table Status:' as status;
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN admission_status = 'approved' THEN 1 END) as approved_students,
    COUNT(CASE WHEN room_allocation_status = 'allocated' THEN 1 END) as allocated_students
FROM admin_student_management;

-- Step 2: Test Room Availability Logic
SELECT 'Step 2: Testing Room Availability Logic...' as step;

-- Check current room availability
SELECT 'Current Room Availability:' as status;
SELECT 
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    GREATEST(0, r.capacity - r.current_occupancy) as available_spots,
    r.status,
    CASE 
        WHEN r.current_occupancy < r.capacity AND r.status IN ('available', 'partially_filled') 
        THEN 'Available' 
        ELSE 'Full/Unavailable' 
    END as availability_status
FROM rooms r
ORDER BY r.floor, r.room_number;

-- Test the available_rooms_view
SELECT 'Available Rooms View Test:' as status;
SELECT 
    room_number,
    floor,
    room_type,
    capacity,
    current_occupancy,
    available_spots,
    status,
    is_available
FROM available_rooms_view
ORDER BY floor, room_number;

-- Step 3: Test Room Allocation for Students
SELECT 'Step 3: Testing Room Allocation for Students...' as step;

-- Check students with room allocations
SELECT 'Students with Room Allocations:' as status;
SELECT 
    u.id as student_id,
    u.full_name as student_name,
    u.username as admission_number,
    u.email as student_email,
    ra.allocation_status,
    ra.allocated_at,
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy
FROM users u
JOIN room_allocations ra ON u.id = ra.user_id
JOIN rooms r ON ra.room_id = r.id
WHERE u.role = 'student'
AND ra.allocation_status IN ('active', 'confirmed')
ORDER BY u.full_name;

-- Step 4: Test Cleaning Request Eligibility
SELECT 'Step 4: Testing Cleaning Request Eligibility...' as step;

-- Check cleaning requests with room allocation validation
SELECT 'Cleaning Requests with Validation:' as status;
SELECT 
    cr.id as cleaning_request_id,
    cr.cleaning_type,
    cr.status as cleaning_status,
    u.full_name as student_name,
    u.username as admission_number,
    r.room_number,
    r.floor,
    ra.allocation_status,
    CASE 
        WHEN ra.id IS NOT NULL AND ra.allocation_status IN ('active', 'confirmed')
        THEN 'Eligible for Cleaning Requests'
        ELSE 'Not Eligible - No Room Allocation'
    END as eligibility_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN rooms r ON cr.room_id = r.id
LEFT JOIN room_allocations ra ON cr.student_id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
ORDER BY cr.created_at DESC;

-- Step 5: Test Room Capacity Updates
SELECT 'Step 5: Testing Room Capacity Updates...' as step;

-- Show rooms with their current occupancy vs capacity
SELECT 'Room Capacity Analysis:' as status;
SELECT 
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    GREATEST(0, r.capacity - r.current_occupancy) as available_spots,
    r.status,
    CASE 
        WHEN r.current_occupancy = 0 THEN 'Empty'
        WHEN r.current_occupancy < r.capacity THEN 'Partially Filled'
        WHEN r.current_occupancy = r.capacity THEN 'Full'
        ELSE 'Over Capacity'
    END as capacity_status
FROM rooms r
ORDER BY r.floor, r.room_number;

-- Step 6: Test Student Workflow Simulation
SELECT 'Step 6: Testing Student Workflow Simulation...' as step;

-- Simulate adding a new student via admin
SELECT 'Simulating New Student Addition:' as status;

-- Check if we can add a new student
INSERT INTO admin_student_management (
    admission_number,
    full_name,
    email,
    phone_number,
    course,
    batch_year,
    semester,
    admission_status,
    room_allocation_status,
    created_by,
    notes
) VALUES 
(
    'TEST001',
    'Test Student',
    'test.student@university.edu',
    '9876543212',
    'MCA',
    2026,
    '4th',
    'approved',
    'not_allocated',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'Test student for workflow validation'
)
ON CONFLICT (email) DO NOTHING;

-- Verify the student was added
SELECT 'New Student Added:' as status;
SELECT 
    admission_number,
    full_name,
    email,
    admission_status,
    room_allocation_status,
    created_at
FROM admin_student_management 
WHERE email = 'test.student@university.edu';

-- Step 7: Test Room Allocation for New Student
SELECT 'Step 7: Testing Room Allocation for New Student...' as step;

-- Find an available room for the test student
SELECT 'Available Rooms for Allocation:' as status;
SELECT 
    id,
    room_number,
    floor,
    room_type,
    capacity,
    current_occupancy,
    GREATEST(0, capacity - current_occupancy) as available_spots
FROM rooms 
WHERE current_occupancy < capacity 
AND status IN ('available', 'partially_filled')
ORDER BY floor, room_number
LIMIT 3;

-- Step 8: Test Complete Workflow
SELECT 'Step 8: Testing Complete Workflow...' as step;

-- Show the complete student journey
SELECT 'Complete Student Workflow Test:' as status;
SELECT 
    'Student Management' as workflow_step,
    COUNT(*) as count,
    'Students in admin system' as description
FROM admin_student_management
UNION ALL
SELECT 
    'User Accounts' as workflow_step,
    COUNT(*) as count,
    'Student user accounts created' as description
FROM users 
WHERE role = 'student'
UNION ALL
SELECT 
    'Room Allocations' as workflow_step,
    COUNT(*) as count,
    'Students with room allocations' as description
FROM room_allocations 
WHERE allocation_status IN ('active', 'confirmed')
UNION ALL
SELECT 
    'Cleaning Requests' as workflow_step,
    COUNT(*) as count,
    'Cleaning requests submitted' as description
FROM cleaning_requests
UNION ALL
SELECT 
    'Eligible for Cleaning' as workflow_step,
    COUNT(*) as count,
    'Students eligible for cleaning requests' as description
FROM users u
JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.role = 'student'
AND ra.allocation_status IN ('active', 'confirmed');

-- Step 9: Test Data Integrity
SELECT 'Step 9: Testing Data Integrity...' as step;

-- Check for any data inconsistencies
SELECT 'Data Integrity Checks:' as status;

-- Check for users without proper room allocations who have cleaning requests
SELECT 'Students with Cleaning Requests but No Room Allocation:' as check_type;
SELECT 
    u.full_name,
    u.email,
    COUNT(cr.id) as cleaning_requests_count
FROM users u
LEFT JOIN room_allocations ra ON u.id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
LEFT JOIN cleaning_requests cr ON u.id = cr.student_id
WHERE u.role = 'student'
AND ra.id IS NULL
AND cr.id IS NOT NULL
GROUP BY u.id, u.full_name, u.email;

-- Check for rooms with incorrect occupancy counts
SELECT 'Rooms with Incorrect Occupancy:' as check_type;
SELECT 
    r.room_number,
    r.current_occupancy,
    COUNT(ra.id) as actual_allocations,
    CASE 
        WHEN r.current_occupancy != COUNT(ra.id) THEN 'MISMATCH'
        ELSE 'CORRECT'
    END as status
FROM rooms r
LEFT JOIN room_allocations ra ON r.id = ra.room_id AND ra.allocation_status IN ('active', 'confirmed')
GROUP BY r.id, r.room_number, r.current_occupancy
HAVING r.current_occupancy != COUNT(ra.id);

SELECT 'Complete Student Workflow Test Finished Successfully!' as status;
