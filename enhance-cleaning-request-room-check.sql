-- Enhance Cleaning Request Room Allocation Check
-- Run this in Supabase SQL Editor

-- Step 1: Create a function to check if student has room allocation before allowing cleaning requests
CREATE OR REPLACE FUNCTION check_student_room_allocation(student_id UUID)
RETURNS TABLE (
    has_allocation BOOLEAN,
    room_id UUID,
    room_number VARCHAR,
    floor INTEGER,
    room_type VARCHAR,
    allocation_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN ra.id IS NOT NULL THEN TRUE ELSE FALSE END as has_allocation,
        ra.room_id,
        r.room_number,
        r.floor,
        r.room_type,
        ra.allocation_status
    FROM room_allocations ra
    LEFT JOIN rooms r ON ra.room_id = r.id
    WHERE ra.user_id = student_id
    AND ra.allocation_status IN ('active', 'confirmed')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to validate cleaning request eligibility
CREATE OR REPLACE FUNCTION validate_cleaning_request_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    allocation_check RECORD;
BEGIN
    -- Check if student has room allocation
    SELECT * INTO allocation_check 
    FROM check_student_room_allocation(NEW.student_id);
    
    -- If no room allocation, prevent cleaning request
    IF NOT allocation_check.has_allocation THEN
        RAISE EXCEPTION 'Student must have an allocated room to request cleaning services';
    END IF;
    
    -- If room allocation exists, automatically set the room_id
    NEW.room_id := allocation_check.room_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to validate cleaning requests
DROP TRIGGER IF EXISTS trigger_validate_cleaning_request ON cleaning_requests;
CREATE TRIGGER trigger_validate_cleaning_request
    BEFORE INSERT ON cleaning_requests
    FOR EACH ROW
    EXECUTE FUNCTION validate_cleaning_request_eligibility();

-- Step 4: Create a view for cleaning requests with room allocation validation
CREATE OR REPLACE VIEW cleaning_requests_with_validation AS
SELECT 
    cr.id,
    cr.student_id,
    cr.room_id,
    cr.preferred_date,
    cr.preferred_time,
    cr.cleaning_type,
    cr.special_instructions,
    cr.status,
    cr.created_at,
    cr.updated_at,
    cr.completed_at,
    cr.notes,
    u.full_name as student_name,
    u.username as admission_number,
    u.email as student_email,
    r.room_number,
    r.floor,
    r.room_type,
    ra.allocation_status,
    CASE 
        WHEN ra.id IS NOT NULL AND ra.allocation_status IN ('active', 'confirmed')
        THEN 'Eligible'
        ELSE 'Not Eligible - No Room Allocation'
    END as eligibility_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN rooms r ON cr.room_id = r.id
LEFT JOIN room_allocations ra ON cr.student_id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
ORDER BY cr.created_at DESC;

-- Step 5: Create a function to get student's allocated room for cleaning requests
CREATE OR REPLACE FUNCTION get_student_allocated_room(student_id UUID)
RETURNS TABLE (
    room_id UUID,
    room_number VARCHAR,
    floor INTEGER,
    room_type VARCHAR,
    capacity INTEGER,
    current_occupancy INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as room_id,
        r.room_number,
        r.floor,
        r.room_type,
        r.capacity,
        r.current_occupancy
    FROM room_allocations ra
    JOIN rooms r ON ra.room_id = r.id
    WHERE ra.user_id = student_id
    AND ra.allocation_status IN ('active', 'confirmed')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Test the validation with existing data
SELECT 'Testing Cleaning Request Validation:' as status;

-- Show current cleaning requests with validation status
SELECT 
    cr.id,
    cr.cleaning_type,
    cr.status,
    u.full_name as student_name,
    u.username as admission_number,
    r.room_number,
    ra.allocation_status,
    CASE 
        WHEN ra.id IS NOT NULL AND ra.allocation_status IN ('active', 'confirmed')
        THEN 'Eligible'
        ELSE 'Not Eligible - No Room Allocation'
    END as eligibility_status
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN rooms r ON cr.room_id = r.id
LEFT JOIN room_allocations ra ON cr.student_id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
ORDER BY cr.created_at DESC;

-- Step 7: Show students with room allocations who can request cleaning
SELECT 'Students Eligible for Cleaning Requests:' as status;
SELECT 
    u.id as student_id,
    u.full_name as student_name,
    u.username as admission_number,
    u.email as student_email,
    r.room_number,
    r.floor,
    r.room_type,
    ra.allocation_status,
    ra.allocated_at
FROM users u
JOIN room_allocations ra ON u.id = ra.user_id
JOIN rooms r ON ra.room_id = r.id
WHERE u.role = 'student'
AND ra.allocation_status IN ('active', 'confirmed')
ORDER BY u.full_name;

-- Step 8: Show students without room allocations (not eligible for cleaning requests)
SELECT 'Students NOT Eligible for Cleaning Requests (No Room Allocation):' as status;
SELECT 
    u.id as student_id,
    u.full_name as student_name,
    u.username as admission_number,
    u.email as student_email,
    u.status as user_status
FROM users u
WHERE u.role = 'student'
AND u.id NOT IN (
    SELECT user_id 
    FROM room_allocations 
    WHERE allocation_status IN ('active', 'confirmed')
)
ORDER BY u.full_name;

SELECT 'Cleaning Request Room Allocation Check Enhanced Successfully!' as status;
