-- Check current status values in users table
-- This will help us see what status values currently exist

SELECT 
    status,
    COUNT(*) as count,
    role
FROM users 
WHERE role IN ('warden', 'hostel_operations_assistant')
GROUP BY status, role
ORDER BY status, role;

-- Also check all users to see the full picture
SELECT 
    status,
    COUNT(*) as count
FROM users 
GROUP BY status
ORDER BY status;
