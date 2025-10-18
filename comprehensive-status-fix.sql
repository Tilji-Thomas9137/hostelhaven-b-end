-- Comprehensive fix for users status constraint and data
-- This script will:
-- 1. Check current status values
-- 2. Fix any invalid status values
-- 3. Update the constraint to allow all three statuses
-- 4. Verify the fix worked

-- Step 1: Check current status distribution
SELECT 'Current status distribution:' as info;
SELECT 
    status,
    COUNT(*) as count,
    role
FROM users 
WHERE role IN ('warden', 'hostel_operations_assistant')
GROUP BY status, role
ORDER BY status, role;

-- Step 2: Drop existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Step 3: Fix any invalid status values
-- Map any invalid statuses to 'active' as default
UPDATE users 
SET status = 'active' 
WHERE status IS NULL 
   OR status NOT IN ('active', 'inactive', 'suspended');

-- Step 4: Add the correct constraint
ALTER TABLE users ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'inactive', 'suspended'));

-- Step 5: Verify the constraint was created
SELECT 'Constraint verification:' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'users_status_check' 
AND conrelid = 'users'::regclass;

-- Step 6: Show final status distribution
SELECT 'Final status distribution:' as info;
SELECT 
    status,
    COUNT(*) as count,
    role
FROM users 
WHERE role IN ('warden', 'hostel_operations_assistant')
GROUP BY status, role
ORDER BY status, role;
