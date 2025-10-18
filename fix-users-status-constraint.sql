-- Fix users status constraint to allow 'active', 'inactive', and 'suspended'
-- This script will drop the existing constraint and recreate it with the correct values

-- First, drop the existing constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Update any invalid status values to 'active' as a fallback
UPDATE users SET status = 'active' 
WHERE status IS NULL OR status NOT IN ('active', 'inactive', 'suspended');

-- Add the new constraint with all three valid status values
ALTER TABLE users ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'inactive', 'suspended'));

-- Verify the constraint was created successfully
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'users_status_check' 
AND conrelid = 'users'::regclass;
