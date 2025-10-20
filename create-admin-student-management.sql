-- Admin Student Management System - Complete Setup
-- Run this in Supabase SQL Editor

-- Step 1: Create a comprehensive admin_student_management table for tracking student admissions
CREATE TABLE IF NOT EXISTS admin_student_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    course VARCHAR(100),
    batch_year INTEGER,
    semester VARCHAR(20),
    admission_date DATE DEFAULT CURRENT_DATE,
    admission_status VARCHAR(20) DEFAULT 'pending' CHECK (admission_status IN ('pending', 'approved', 'rejected', 'active', 'inactive')),
    room_allocation_status VARCHAR(20) DEFAULT 'not_allocated' CHECK (room_allocation_status IN ('not_allocated', 'allocated', 'confirmed')),
    allocated_room_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL, -- Admin who created the admission
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Step 2: Add foreign key constraints
DO $$
BEGIN
    -- Add foreign key to users table
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        ALTER TABLE admin_student_management 
        ADD CONSTRAINT fk_admin_student_management_student_id 
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to users table';
    END IF;
    
    -- Add foreign key to rooms table
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'rooms'
    ) THEN
        ALTER TABLE admin_student_management 
        ADD CONSTRAINT fk_admin_student_management_room_id 
        FOREIGN KEY (allocated_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key constraint to rooms table';
    END IF;
    
    -- Add foreign key to users table for created_by
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        ALTER TABLE admin_student_management 
        ADD CONSTRAINT fk_admin_student_management_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
        RAISE NOTICE 'Added foreign key constraint for created_by';
    END IF;
END $$;

-- Step 3: Create a function to automatically create user when admin adds a student
CREATE OR REPLACE FUNCTION create_student_user_from_admin()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = NEW.email) THEN
        -- Create user account
        INSERT INTO users (
            email,
            full_name,
            username,
            role,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.email,
            NEW.full_name,
            NEW.admission_number,
            'student',
            'active',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created user account for student: %', NEW.email;
    END IF;
    
    -- Update the student_id to match the created user
    UPDATE admin_student_management 
    SET student_id = (SELECT id FROM users WHERE email = NEW.email LIMIT 1)
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically create user when admin adds student
DROP TRIGGER IF EXISTS trigger_create_student_user ON admin_student_management;
CREATE TRIGGER trigger_create_student_user
    AFTER INSERT ON admin_student_management
    FOR EACH ROW
    EXECUTE FUNCTION create_student_user_from_admin();

-- Step 5: Create a function to automatically allocate room when admin approves student
CREATE OR REPLACE FUNCTION allocate_room_for_approved_student()
RETURNS TRIGGER AS $$
BEGIN
    -- If room allocation status changed to 'allocated' and room_id is provided
    IF NEW.room_allocation_status = 'allocated' AND NEW.allocated_room_id IS NOT NULL THEN
        -- Create room allocation record
        INSERT INTO room_allocations (
            user_id,
            room_id,
            allocation_status,
            allocated_at,
            start_date,
            allocation_date,
            created_at,
            updated_at
        ) VALUES (
            NEW.student_id,
            NEW.allocated_room_id,
            'confirmed',
            NOW(),
            CURRENT_DATE,
            NOW(),
            NOW(),
            NOW()
        );
        
        -- Update room occupancy
        UPDATE rooms 
        SET current_occupancy = current_occupancy + 1,
            updated_at = NOW()
        WHERE id = NEW.allocated_room_id;
        
        RAISE NOTICE 'Room allocated for student: %', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for room allocation
DROP TRIGGER IF EXISTS trigger_allocate_room ON admin_student_management;
CREATE TRIGGER trigger_allocate_room
    AFTER UPDATE ON admin_student_management
    FOR EACH ROW
    EXECUTE FUNCTION allocate_room_for_approved_student();

-- Step 7: Insert sample admin student records
INSERT INTO admin_student_management (
    admission_number,
    full_name,
    email,
    phone_number,
    course,
    batch_year,
    semester,
    admission_status,
    room_allocation_status,
    created_by,
    notes
) VALUES 
(
    '13187',
    'John Smith',
    'john.smith@university.edu',
    '9876543210',
    'MCA',
    2026,
    '4th',
    'approved',
    'not_allocated',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'New student admission - pending room allocation'
),
(
    '13188',
    'Sarah Johnson',
    'sarah.johnson@university.edu',
    '9876543211',
    'MCA',
    2026,
    '4th',
    'approved',
    'allocated',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    'Student admitted and room allocated'
)
ON CONFLICT (email) DO NOTHING;

-- Step 8: Create a view for easy admin management
CREATE OR REPLACE VIEW admin_student_overview AS
SELECT 
    asm.id,
    asm.admission_number,
    asm.full_name,
    asm.email,
    asm.phone_number,
    asm.course,
    asm.batch_year,
    asm.semester,
    asm.admission_status,
    asm.room_allocation_status,
    asm.allocated_room_id,
    asm.allocated_at,
    asm.created_at,
    r.room_number,
    r.floor,
    r.room_type,
    r.capacity,
    r.current_occupancy,
    u.username as student_username,
    u.status as user_status
FROM admin_student_management asm
LEFT JOIN users u ON asm.student_id = u.id
LEFT JOIN rooms r ON asm.allocated_room_id = r.id
ORDER BY asm.created_at DESC;

-- Step 9: Verify the setup
SELECT 'Admin Student Management System Setup Complete!' as status;

-- Show sample data
SELECT * FROM admin_student_overview LIMIT 5;
