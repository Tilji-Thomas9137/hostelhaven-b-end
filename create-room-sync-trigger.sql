-- Create a trigger to automatically sync users.room_id when room_allocations are created
-- This ensures that when HO approves a room request, the users.room_id is automatically updated

-- First, create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION sync_user_room_id()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user_id from user_profiles
    SELECT user_id INTO v_user_id
    FROM user_profiles
    WHERE id = NEW.student_profile_id;
    
    -- Update users.room_id if we have both user_id and room_id
    IF v_user_id IS NOT NULL AND NEW.room_id IS NOT NULL AND NEW.allocation_status IN ('confirmed', 'active') THEN
        UPDATE users
        SET room_id = NEW.room_id,
            updated_at = NOW()
        WHERE id = v_user_id
        AND (room_id IS NULL OR room_id != NEW.room_id);
        
        RAISE NOTICE 'Synced room_id % to user %', NEW.room_id, v_user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_sync_user_room_id ON room_allocations;
CREATE TRIGGER trigger_sync_user_room_id
    AFTER INSERT OR UPDATE ON room_allocations
    FOR EACH ROW
    WHEN (NEW.allocation_status IN ('confirmed', 'active'))
    EXECUTE FUNCTION sync_user_room_id();

-- Run the sync once for existing records
DO $$
DECLARE
    allocation_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting room allocation sync...';
    
    -- Update users table with room_id from active room allocations
    FOR allocation_record IN 
        SELECT DISTINCT
            ra.room_id,
            up.user_id
        FROM room_allocations ra
        JOIN user_profiles up ON ra.student_profile_id = up.id
        WHERE ra.allocation_status IN ('confirmed', 'active')
        AND ra.room_id IS NOT NULL
        AND up.user_id IS NOT NULL
    LOOP
        -- Update the user's room_id
        UPDATE users 
        SET room_id = allocation_record.room_id
        WHERE id = allocation_record.user_id
        AND (room_id IS NULL OR room_id != allocation_record.room_id);
        
        -- Check if update was successful
        IF FOUND THEN
            updated_count := updated_count + 1;
            RAISE NOTICE 'Updated user % with room_id %', allocation_record.user_id, allocation_record.room_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Room allocation sync completed. Updated % users.', updated_count;
END $$;

-- Verify the sync
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.room_id,
    r.room_number,
    r.floor,
    r.room_type
FROM users u
LEFT JOIN rooms r ON u.room_id = r.id
WHERE u.room_id IS NOT NULL
ORDER BY u.full_name
LIMIT 10;

