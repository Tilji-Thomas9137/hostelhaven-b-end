-- Fix Room Availability Logic - Ensure Full Capacity Rooms Are Not Displayed
-- Run this in Supabase SQL Editor

-- Step 1: Create a function to calculate room availability correctly
CREATE OR REPLACE FUNCTION calculate_room_availability(room_id UUID)
RETURNS TABLE (
    is_available BOOLEAN,
    available_spots INTEGER,
    current_occupancy INTEGER,
    total_capacity INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN r.current_occupancy < r.capacity AND r.status IN ('available', 'partially_filled') 
            THEN TRUE 
            ELSE FALSE 
        END as is_available,
        GREATEST(0, r.capacity - r.current_occupancy) as available_spots,
        r.current_occupancy,
        r.capacity
    FROM rooms r
    WHERE r.id = room_id;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a view for available rooms only
CREATE OR REPLACE VIEW available_rooms_view AS
SELECT 
    r.id,
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    GREATEST(0, r.capacity - r.current_occupancy) as available_spots,
    r.status,
    r.price,
    r.amenities,
    r.created_at,
    r.updated_at,
    CASE 
        WHEN r.current_occupancy < r.capacity AND r.status IN ('available', 'partially_filled') 
        THEN TRUE 
        ELSE FALSE 
    END as is_available
FROM rooms r
WHERE r.status IN ('available', 'partially_filled')
AND r.current_occupancy < r.capacity;

-- Step 3: Update existing rooms to ensure correct capacity tracking
UPDATE rooms 
SET 
    current_occupancy = (
        SELECT COUNT(*) 
        FROM room_allocations 
        WHERE room_id = rooms.id 
        AND allocation_status IN ('active', 'confirmed')
    ),
    updated_at = NOW()
WHERE id IN (
    SELECT id FROM rooms 
    WHERE current_occupancy IS NULL OR current_occupancy < 0
);

-- Step 4: Create a function to update room occupancy when allocations change
CREATE OR REPLACE FUNCTION update_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (new allocation)
    IF TG_OP = 'INSERT' AND NEW.allocation_status IN ('active', 'confirmed') THEN
        UPDATE rooms 
        SET 
            current_occupancy = current_occupancy + 1,
            status = CASE 
                WHEN current_occupancy + 1 >= capacity THEN 'full'
                WHEN current_occupancy + 1 > 0 THEN 'partially_filled'
                ELSE 'available'
            END,
            updated_at = NOW()
        WHERE id = NEW.room_id;
    END IF;
    
    -- Handle UPDATE (status change)
    IF TG_OP = 'UPDATE' THEN
        -- If allocation was active and is now inactive
        IF OLD.allocation_status IN ('active', 'confirmed') AND NEW.allocation_status NOT IN ('active', 'confirmed') THEN
            UPDATE rooms 
            SET 
                current_occupancy = GREATEST(0, current_occupancy - 1),
                status = CASE 
                    WHEN current_occupancy - 1 <= 0 THEN 'available'
                    WHEN current_occupancy - 1 < capacity THEN 'partially_filled'
                    ELSE 'full'
                END,
                updated_at = NOW()
            WHERE id = NEW.room_id;
        END IF;
        
        -- If allocation was inactive and is now active
        IF OLD.allocation_status NOT IN ('active', 'confirmed') AND NEW.allocation_status IN ('active', 'confirmed') THEN
            UPDATE rooms 
            SET 
                current_occupancy = current_occupancy + 1,
                status = CASE 
                    WHEN current_occupancy + 1 >= capacity THEN 'full'
                    WHEN current_occupancy + 1 > 0 THEN 'partially_filled'
                    ELSE 'available'
                END,
                updated_at = NOW()
            WHERE id = NEW.room_id;
        END IF;
    END IF;
    
    -- Handle DELETE (allocation removed)
    IF TG_OP = 'DELETE' AND OLD.allocation_status IN ('active', 'confirmed') THEN
        UPDATE rooms 
        SET 
            current_occupancy = GREATEST(0, current_occupancy - 1),
            status = CASE 
                WHEN current_occupancy - 1 <= 0 THEN 'available'
                WHEN current_occupancy - 1 < capacity THEN 'partially_filled'
                ELSE 'full'
            END,
            updated_at = NOW()
        WHERE id = OLD.room_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create triggers to automatically update room occupancy
DROP TRIGGER IF EXISTS trigger_update_room_occupancy_insert ON room_allocations;
DROP TRIGGER IF EXISTS trigger_update_room_occupancy_update ON room_allocations;
DROP TRIGGER IF EXISTS trigger_update_room_occupancy_delete ON room_allocations;

CREATE TRIGGER trigger_update_room_occupancy_insert
    AFTER INSERT ON room_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_room_occupancy();

CREATE TRIGGER trigger_update_room_occupancy_update
    AFTER UPDATE ON room_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_room_occupancy();

CREATE TRIGGER trigger_update_room_occupancy_delete
    AFTER DELETE ON room_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_room_occupancy();

-- Step 6: Verify current room availability
SELECT 'Current Room Availability Status:' as status;
SELECT 
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    GREATEST(0, r.capacity - r.current_occupancy) as available_spots,
    r.status,
    CASE 
        WHEN r.current_occupancy < r.capacity AND r.status IN ('available', 'partially_filled') 
        THEN 'Available' 
        ELSE 'Full/Unavailable' 
    END as availability_status
FROM rooms r
ORDER BY r.floor, r.room_number;

-- Step 7: Show only available rooms
SELECT 'Available Rooms Only:' as status;
SELECT 
    room_number,
    floor,
    room_type,
    capacity,
    current_occupancy,
    available_spots,
    status
FROM available_rooms_view
ORDER BY floor, room_number;

SELECT 'Room Availability Logic Fixed Successfully!' as status;
