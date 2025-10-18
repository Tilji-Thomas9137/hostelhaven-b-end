# Fix Staff Status Constraint Issue

## Problem
The database constraint `users_status_check` is rejecting status updates because it's more restrictive than expected. The error shows:
```
new row for relation "users" violates check constraint "users_status_check"
```

## Solution
Run the following SQL script in your Supabase SQL Editor to fix the constraint:

### Step 1: Go to Supabase Dashboard
1. Open your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query

### Step 2: Run the Fix Script
Copy and paste this SQL script and click "Run":

```sql
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
```

### Step 3: Verify the Fix
After running the script, you should see output showing the constraint was created with the correct values.

### Step 4: Test the Staff Activation
Once the constraint is fixed, try activating your staff members again. The activation/deactivation functionality should now work without errors.

## What This Fix Does
1. **Removes the old restrictive constraint** that was causing the errors
2. **Updates any invalid status values** to 'active' as a safe default
3. **Creates a new constraint** that allows all three valid statuses: 'active', 'inactive', 'suspended'
4. **Verifies the constraint** was created correctly

After this fix, your staff activation/deactivation feature will work perfectly!
