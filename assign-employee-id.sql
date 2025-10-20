-- Assign Employee ID to Operations Assistant
-- Run this in Supabase SQL Editor

-- Update the operations assistant with an employee ID
UPDATE users 
SET 
    employee_id = 'HOPS-001',
    updated_at = NOW()
WHERE (role = 'hostel_operations_assistant' OR email = 'tilji0119@gmail.com')
  AND (employee_id IS NULL OR employee_id = '');

-- Verify the update
SELECT 
    id,
    email,
    full_name,
    role,
    employee_id,
    created_at,
    updated_at
FROM users 
WHERE role = 'hostel_operations_assistant' 
   OR email = 'tilji0119@gmail.com'
ORDER BY created_at DESC;

-- Show success message
SELECT 'Employee ID assigned successfully!' as status;
