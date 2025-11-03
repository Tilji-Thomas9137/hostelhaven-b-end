-- SIMPLE STEP-BY-STEP GUIDE: Option A Implementation
-- Run these commands ONE BY ONE in Supabase SQL Editor

-- STEP 1: Check if you have duplicate allocations
SELECT 
    user_id,
    COUNT(*) as allocation_count
FROM room_allocations
GROUP BY user_id
HAVING COUNT(*) > 1;

-- STEP 2: If you see duplicates above, clean them up (keep only the most recent)
-- WARNING: This deletes older duplicate allocations
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM room_allocations
)
DELETE FROM room_allocations 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- STEP 3: Add the unique constraint (this is the key step)
CREATE UNIQUE INDEX IF NOT EXISTS room_allocations_user_unique
ON room_allocations (user_id);

-- STEP 4: Verify the constraint was created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'room_allocations' 
AND indexname = 'room_allocations_user_unique';

-- STEP 5: Now you can use the ON CONFLICT syntax!
-- Replace the UUIDs with your actual student and room IDs
INSERT INTO room_allocations (user_id, room_id, allocation_status, start_date)
VALUES (
    '3ac8eba1-3ba8-4035-821e-4fb275f05105', -- Replace with actual student user_id
    '6fdf1b74-ca27-44d9-9e19-68a0aaed488a', -- Replace with actual room_id
    'confirmed',
    CURRENT_DATE
)
ON CONFLICT (user_id) DO UPDATE
SET 
    room_id = EXCLUDED.room_id,
    allocation_status = 'confirmed',
    start_date = EXCLUDED.start_date,
    updated_at = NOW();

-- STEP 6: Update room occupancy (optional but recommended)
UPDATE rooms 
SET current_occupancy = LEAST(capacity, current_occupancy + 1)
WHERE id = '6fdf1b74-ca27-44d9-9e19-68a0aaed488a'; -- Replace with actual room_id

-- STEP 7: Verify the allocation was created/updated
SELECT 
    ra.user_id,
    u.email,
    u.linked_admission_number,
    ra.room_id,
    r.room_number,
    ra.allocation_status,
    ra.start_date
FROM room_allocations ra
JOIN users u ON ra.user_id = u.id
LEFT JOIN rooms r ON ra.room_id = r.id
WHERE ra.user_id = '3ac8eba1-3ba8-4035-821e-4fb275f05105'; -- Replace with actual user_id
