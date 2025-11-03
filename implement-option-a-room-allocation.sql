-- Option A: Implement unique constraint on user_id for room_allocations
-- This ensures one allocation per student and enables ON CONFLICT functionality
-- Run this in Supabase SQL Editor

-- Step 1: Check current table structure
SELECT 
    'Current room_allocations structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations'
ORDER BY ordinal_position;

-- Step 2: Check existing constraints
SELECT 
    'Existing constraints:' as info,
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
AND tc.table_name = 'room_allocations'
ORDER BY tc.constraint_name;

-- Step 3: Check for duplicate user_id entries (clean up if needed)
SELECT 
    'Duplicate user_id entries (if any):' as info,
    user_id,
    COUNT(*) as allocation_count
FROM room_allocations
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Step 4: Clean up duplicates (keep the most recent allocation per user)
-- WARNING: This will delete older duplicate allocations
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, allocation_date DESC) as rn
    FROM room_allocations
)
DELETE FROM room_allocations 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 5: Add unique constraint on user_id
-- This ensures only one allocation per student
CREATE UNIQUE INDEX IF NOT EXISTS room_allocations_user_unique
ON room_allocations (user_id);

-- Step 6: Verify the constraint was created
SELECT 
    'Unique constraint verification:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'room_allocations' 
AND indexname = 'room_allocations_user_unique';

-- Step 7: Test the upsert functionality
-- Replace the placeholder values with actual IDs from your database
-- Example usage (uncomment and modify as needed):

/*
-- Example: Allocate room for student with admission number '13186'
-- First, get the student's user_id
WITH student_info AS (
    SELECT id as user_id, email, linked_admission_number
    FROM users 
    WHERE linked_admission_number = '13186' 
    AND role = 'student'
    LIMIT 1
),
room_info AS (
    SELECT id as room_id, room_number, capacity, current_occupancy
    FROM rooms 
    WHERE room_number = '101' -- Replace with actual room number
    LIMIT 1
)
INSERT INTO room_allocations (user_id, room_id, allocation_status, start_date)
SELECT 
    si.user_id,
    ri.room_id,
    'confirmed',
    CURRENT_DATE
FROM student_info si, room_info ri
ON CONFLICT (user_id) DO UPDATE
SET 
    room_id = EXCLUDED.room_id,
    allocation_status = 'confirmed',
    start_date = EXCLUDED.start_date,
    updated_at = NOW()
RETURNING 
    user_id,
    room_id,
    allocation_status,
    start_date;
*/

-- Step 8: Create a helper function for room allocation with occupancy management
CREATE OR REPLACE FUNCTION allocate_room_to_student(
    p_user_id UUID,
    p_room_id UUID,
    p_allocation_status VARCHAR(20) DEFAULT 'confirmed'
) RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    old_room_id UUID,
    new_room_id UUID
) AS $$
DECLARE
    v_old_room_id UUID;
    v_new_room_id UUID;
    v_room_capacity INTEGER;
    v_current_occupancy INTEGER;
BEGIN
    -- Get old room allocation
    SELECT room_id INTO v_old_room_id
    FROM room_allocations
    WHERE user_id = p_user_id;
    
    -- Get room capacity
    SELECT capacity, current_occupancy INTO v_room_capacity, v_current_occupancy
    FROM rooms
    WHERE id = p_room_id;
    
    -- Check if room has capacity
    IF v_current_occupancy >= v_room_capacity THEN
        RETURN QUERY SELECT FALSE, 'Room is at full capacity', v_old_room_id, p_room_id;
        RETURN;
    END IF;
    
    -- Upsert allocation
    INSERT INTO room_allocations (user_id, room_id, allocation_status, start_date)
    VALUES (p_user_id, p_room_id, p_allocation_status, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        room_id = EXCLUDED.room_id,
        allocation_status = EXCLUDED.allocation_status,
        start_date = EXCLUDED.start_date,
        updated_at = NOW()
    RETURNING room_id INTO v_new_room_id;
    
    -- Update occupancy for new room (increment)
    UPDATE rooms 
    SET current_occupancy = LEAST(capacity, current_occupancy + 1)
    WHERE id = v_new_room_id;
    
    -- Update occupancy for old room (decrement) if different
    IF v_old_room_id IS NOT NULL AND v_old_room_id != v_new_room_id THEN
        UPDATE rooms 
        SET current_occupancy = GREATEST(0, current_occupancy - 1)
        WHERE id = v_old_room_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Room allocated successfully', v_old_room_id, v_new_room_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Test the helper function
-- Example usage (uncomment and modify as needed):
/*
-- Example: Allocate room for student
SELECT * FROM allocate_room_to_student(
    '3ac8eba1-3ba8-4035-821e-4fb275f05105', -- student user_id
    '6fdf1b74-ca27-44d9-9e19-68a0aaed488a'  -- room_id
);
*/

-- Step 10: Verify everything is working
SELECT 
    'Final verification:' as info,
    COUNT(*) as total_allocations,
    COUNT(DISTINCT user_id) as unique_students,
    COUNT(*) - COUNT(DISTINCT user_id) as duplicates_remaining
FROM room_allocations;

-- Show current allocations
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
ORDER BY ra.created_at DESC
LIMIT 10;
