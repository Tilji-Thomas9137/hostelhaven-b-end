-- Fix Admin Student Details - Add Parent Information Support
-- Run this in Supabase SQL Editor

-- Step 1: Create a comprehensive student details view with parent information
CREATE OR REPLACE VIEW admin_student_details_view AS
SELECT 
    u.id as user_id,
    u.auth_uid,
    u.email,
    u.full_name,
    u.username,
    u.role,
    u.status as user_status,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    
    -- Student profile information
    up.admission_number,
    up.course,
    up.batch_year,
    up.semester,
    up.phone_number as student_phone,
    up.avatar_url,
    up.profile_status,
    
    -- Parent information (if exists)
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation,
    p.parent_occupation,
    p.parent_address,
    
    -- Room allocation information
    ra.id as room_allocation_id,
    ra.room_id,
    ra.allocation_status,
    ra.allocated_at,
    ra.start_date,
    ra.end_date,
    
    -- Room information
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    r.status as room_status,
    r.price as room_price,
    
    -- Admin student management information
    asm.id as admin_student_id,
    asm.admission_status,
    asm.room_allocation_status,
    asm.allocated_room_id as admin_allocated_room_id,
    asm.allocated_at as admin_allocated_at,
    asm.notes as admin_notes,
    asm.created_at as admin_created_at
    
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN parents p ON u.id = p.student_id
LEFT JOIN room_allocations ra ON u.id = ra.user_id AND ra.allocation_status IN ('active', 'confirmed')
LEFT JOIN rooms r ON ra.room_id = r.id OR asm.allocated_room_id = r.id
LEFT JOIN admin_student_management asm ON u.id = asm.student_id
WHERE u.role = 'student'
ORDER BY u.created_at DESC;

-- Step 2: Create a function to get complete student details with parent information
CREATE OR REPLACE FUNCTION get_student_details_with_parent(student_id UUID)
RETURNS TABLE (
    user_id UUID,
    auth_uid UUID,
    email VARCHAR,
    full_name VARCHAR,
    username VARCHAR,
    role VARCHAR,
    user_status VARCHAR,
    user_created_at TIMESTAMP WITH TIME ZONE,
    user_updated_at TIMESTAMP WITH TIME ZONE,
    admission_number VARCHAR,
    course VARCHAR,
    batch_year INTEGER,
    semester VARCHAR,
    student_phone VARCHAR,
    avatar_url TEXT,
    profile_status VARCHAR,
    parent_name VARCHAR,
    parent_email VARCHAR,
    parent_phone VARCHAR,
    parent_relation VARCHAR,
    parent_occupation VARCHAR,
    parent_address TEXT,
    room_allocation_id UUID,
    room_id UUID,
    allocation_status VARCHAR,
    allocated_at TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    end_date DATE,
    room_number VARCHAR,
    floor INTEGER,
    room_type VARCHAR,
    capacity INTEGER,
    current_occupancy INTEGER,
    room_status VARCHAR,
    room_price DECIMAL,
    admin_student_id UUID,
    admission_status VARCHAR,
    room_allocation_status VARCHAR,
    admin_allocated_room_id UUID,
    admin_allocated_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    admin_created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM admin_student_details_view WHERE user_id = student_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Test the view with existing student data
SELECT 'Testing admin_student_details_view...' as status;
SELECT 
    user_id,
    full_name,
    email,
    admission_number,
    course,
    batch_year,
    student_phone,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    room_number,
    floor,
    room_type,
    admission_status,
    room_allocation_status
FROM admin_student_details_view
LIMIT 5;

-- Step 4: Check if parents table exists and has data
SELECT 'Checking parents table...' as status;
SELECT 
    COUNT(*) as total_parents,
    COUNT(CASE WHEN student_id IS NOT NULL THEN 1 END) as parents_with_student_id
FROM parents;

-- Step 5: Show sample parent data
SELECT 'Sample parent data:' as status;
SELECT 
    p.id,
    p.student_id,
    p.parent_name,
    p.parent_email,
    p.parent_phone,
    p.parent_relation,
    u.full_name as student_name,
    u.email as student_email
FROM parents p
LEFT JOIN users u ON p.student_id = u.id
LIMIT 5;

-- Step 6: Check if user_profiles table has the required fields
SELECT 'Checking user_profiles table structure...' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Step 7: Create sample parent data for existing students if needed
INSERT INTO parents (
    student_id,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    parent_occupation,
    parent_address
)
SELECT 
    u.id,
    'Sample Parent Name',
    'parent@example.com',
    '9876543210',
    'Father',
    'Business',
    'Sample Address'
FROM users u
WHERE u.role = 'student'
AND u.id NOT IN (SELECT student_id FROM parents WHERE student_id IS NOT NULL)
LIMIT 1
ON CONFLICT (student_id) DO NOTHING;

-- Step 8: Verify the complete student details
SELECT 'Complete student details with parent information:' as status;
SELECT 
    user_id,
    full_name as student_name,
    email as student_email,
    admission_number,
    course,
    batch_year,
    student_phone,
    parent_name,
    parent_email,
    parent_phone,
    parent_relation,
    room_number,
    admission_status,
    room_allocation_status
FROM admin_student_details_view
WHERE user_id = (SELECT id FROM users WHERE role = 'student' LIMIT 1);

SELECT 'Admin student details fix completed successfully!' as status;
