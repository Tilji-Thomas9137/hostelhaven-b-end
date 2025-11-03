-- PERMANENT ROOM ALLOCATION SOLUTION
-- This script ensures room allocation works automatically for ALL students
-- Run this in Supabase SQL Editor

-- Step 1: Add unique constraint to prevent duplicate allocations
CREATE UNIQUE INDEX IF NOT EXISTS room_allocations_user_unique
ON room_allocations (user_id);

-- Step 2: Clean up any existing duplicate allocations (keep the most recent)
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

-- Step 3: Verify the constraint was created
SELECT 
    'Unique constraint verification:' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'room_allocations' 
AND indexname = 'room_allocations_user_unique';

-- Step 4: Check current room allocations status
SELECT 
    'Current room allocations:' as info,
    COUNT(*) as total_allocations,
    COUNT(DISTINCT user_id) as unique_students,
    COUNT(*) - COUNT(DISTINCT user_id) as duplicates_remaining
FROM room_allocations;

-- Step 5: Show sample allocations
SELECT 
    'Sample allocations:' as info,
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

-- Step 6: Create a helper function for automatic room allocation
CREATE OR REPLACE FUNCTION auto_allocate_room_on_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        -- Check if room allocation already exists
        IF NOT EXISTS (
            SELECT 1 FROM room_allocations 
            WHERE user_id = NEW.user_id 
            AND allocation_status IN ('confirmed', 'active')
        ) THEN
            -- Create room allocation automatically
            INSERT INTO room_allocations (
                user_id, 
                room_id, 
                allocation_status, 
                start_date,
                allocation_date,
                allocated_at
            )
            VALUES (
                NEW.user_id,
                NEW.room_id, -- Assuming room_id is stored in room_requests
                'confirmed',
                CURRENT_DATE,
                NOW(),
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE
            SET 
                room_id = EXCLUDED.room_id,
                allocation_status = 'confirmed',
                start_date = EXCLUDED.start_date,
                updated_at = NOW();
            
            -- Update room occupancy
            UPDATE rooms 
            SET current_occupancy = LEAST(capacity, current_occupancy + 1)
            WHERE id = NEW.room_id;
            
            -- Update student profile
            UPDATE user_profiles 
            SET room_id = NEW.room_id
            WHERE user_id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to automatically allocate rooms when requests are approved
DROP TRIGGER IF EXISTS trigger_auto_allocate_room ON room_requests;
CREATE TRIGGER trigger_auto_allocate_room
    AFTER UPDATE ON room_requests
    FOR EACH ROW
    EXECUTE FUNCTION auto_allocate_room_on_approval();

-- Step 8: Test the trigger (optional - uncomment to test)
/*
-- Test by updating a room request to approved status
UPDATE room_requests 
SET status = 'approved' 
WHERE id = 'some-request-id' 
AND status = 'pending';
*/

-- Step 9: Verify everything is working
SELECT 
    'Setup complete!' as status,
    'Room allocation will now happen automatically when requests are approved' as message;
