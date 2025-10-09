# Database Fix Instructions

## Issue 1: Missing urgency_level Column

The room request is failing because the `urgency_level` column is missing from the `room_requests` table.

### Fix: Add the missing column

Go to your Supabase dashboard → SQL Editor and run:

```sql
-- Add urgency_level column to room_requests table
ALTER TABLE room_requests 
ADD COLUMN urgency_level VARCHAR(20) DEFAULT 'normal';

-- Add constraint for valid urgency levels
ALTER TABLE room_requests 
ADD CONSTRAINT check_urgency_level 
CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent'));

-- Update existing records
UPDATE room_requests 
SET urgency_level = 'normal' 
WHERE urgency_level IS NULL;
```

## Issue 2: Room Data Inconsistencies

Multiple rooms have incorrect types and capacities based on their naming conventions.

### Fix: Correct room types and capacities

```sql
-- Fix A1102 capacity (should be single with capacity 1)
UPDATE rooms 
SET capacity = 1 
WHERE room_number = 'A1102';

-- Fix D201 capacity (should be single with capacity 1)
UPDATE rooms 
SET capacity = 1 
WHERE room_number = 'D201';

-- Fix T-prefix rooms to be triple type with capacity 3
UPDATE rooms 
SET room_type = 'triple', capacity = 3 
WHERE room_number LIKE 'T%';

-- Fix D-prefix rooms to be double type with capacity 2
UPDATE rooms 
SET room_type = 'double', capacity = 2 
WHERE room_number LIKE 'D%';

-- Verify the changes
SELECT room_number, room_type, capacity, price, floor
FROM rooms 
ORDER BY room_number;
```

## Expected Results After Fix

After running these commands, you should see:

- Room requests will work without the urgency_level error
- Room types and capacities will be consistent:
  - A1102: single, capacity 1
  - T101-T105, T201, T203, T301, T302: triple, capacity 3
  - D201: double, capacity 2
  - S101: single, capacity 1
  - Other rooms: single, capacity 1

## How to Run These Fixes

1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste each SQL block above
4. Click "Run" to execute each block
5. Verify the results by running the SELECT query at the end

After these fixes, the room request functionality should work properly!
