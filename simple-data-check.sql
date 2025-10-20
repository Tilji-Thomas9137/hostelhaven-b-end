-- Simple check to see what data exists
-- Run this in Supabase SQL Editor

-- Check cleaning requests
SELECT 'Cleaning requests:' as step;
SELECT id, student_id, cleaning_type, status FROM cleaning_requests LIMIT 5;

-- Check users table
SELECT 'Users table:' as step;
SELECT id, email, full_name, username, role FROM users WHERE role = 'student' LIMIT 5;

-- Check admission registry
SELECT 'Admission registry:' as step;
SELECT id, user_id, admission_number FROM admission_registry LIMIT 5;

-- Check if student_id from cleaning_requests matches user id
SELECT 'Data linking check:' as step;
SELECT 
    cr.id as cleaning_request_id,
    cr.student_id,
    cr.cleaning_type,
    u.id as user_id,
    u.email,
    u.full_name,
    u.username
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LIMIT 5;
