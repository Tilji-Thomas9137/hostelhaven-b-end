-- HostelHaven Database Setup
-- Date: 2025-01-15
-- Purpose: Create all necessary tables for the application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE CLEANING_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cleaning_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    student_id UUID NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time VARCHAR(20) NOT NULL CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
    cleaning_type VARCHAR(20) NOT NULL CHECK (cleaning_type IN ('general', 'deep', 'window', 'bathroom')),
    special_instructions TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- ============================================================================
-- CREATE ROOM_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    student_profile_id UUID,
    room_id UUID,
    request_type VARCHAR(20) DEFAULT 'allocation' CHECK (request_type IN ('allocation', 'change')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    priority INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_room_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    preferred_room_type VARCHAR(20),
    preferred_floor INTEGER,
    special_requirements TEXT,
    urgency_level VARCHAR(20) DEFAULT 'medium' CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent'))
);

-- ============================================================================
-- CREATE LEAVE_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('emergency', 'medical', 'personal', 'family', 'academic')),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    destination VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    rejection_reason TEXT
);

-- ============================================================================
-- CREATE ROOM_ALLOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- This is the missing column causing the error
    student_profile_id UUID,
    room_id UUID NOT NULL,
    request_id UUID, -- Reference to the original room request
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Add foreign key constraints
ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_request_id 
FOREIGN KEY (request_id) REFERENCES room_requests(id) ON DELETE SET NULL;

-- ============================================================================
-- CREATE COMPLAINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('maintenance', 'cleanliness', 'noise', 'security', 'food', 'other')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT,
    resolved_by UUID
);

-- ============================================================================
-- CREATE ROOMS TABLE (if it doesn't exist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(20) UNIQUE NOT NULL,
    floor INTEGER NOT NULL,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'suite')),
    capacity INTEGER NOT NULL,
    current_occupancy INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE USERS TABLE (if it doesn't exist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'warden', 'hostel_operations_assistant', 'student', 'parent')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE USER_PROFILES TABLE (if it doesn't exist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Cleaning requests foreign keys
ALTER TABLE cleaning_requests 
ADD CONSTRAINT IF NOT EXISTS fk_cleaning_requests_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE cleaning_requests 
ADD CONSTRAINT IF NOT EXISTS fk_cleaning_requests_student_id 
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE cleaning_requests 
ADD CONSTRAINT IF NOT EXISTS fk_cleaning_requests_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Room requests foreign keys
ALTER TABLE room_requests 
ADD CONSTRAINT IF NOT EXISTS fk_room_requests_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_requests 
ADD CONSTRAINT IF NOT EXISTS fk_room_requests_allocated_room_id 
FOREIGN KEY (allocated_room_id) REFERENCES rooms(id) ON DELETE SET NULL;

ALTER TABLE room_requests 
ADD CONSTRAINT IF NOT EXISTS fk_room_requests_processed_by 
FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;

-- Leave requests foreign keys
ALTER TABLE leave_requests 
ADD CONSTRAINT IF NOT EXISTS fk_leave_requests_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE leave_requests 
ADD CONSTRAINT IF NOT EXISTS fk_leave_requests_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Complaints foreign keys
ALTER TABLE complaints 
ADD CONSTRAINT IF NOT EXISTS fk_complaints_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE complaints 
ADD CONSTRAINT IF NOT EXISTS fk_complaints_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT IF NOT EXISTS fk_complaints_resolved_by 
FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================================

-- Cleaning requests indexes
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_room_id ON cleaning_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_student_id ON cleaning_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_status ON cleaning_requests(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_created_at ON cleaning_requests(created_at);

-- Room requests indexes
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_requests_created_at ON room_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_room_requests_requested_at ON room_requests(requested_at);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_from_date ON leave_requests(from_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON leave_requests(created_at);

-- Complaints indexes
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaning_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leave_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- INSERT SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample rooms
INSERT INTO rooms (room_number, floor, room_type, capacity, status) VALUES
('101', 1, 'single', 1, 'available'),
('102', 1, 'double', 2, 'available'),
('103', 1, 'triple', 3, 'available'),
('201', 2, 'single', 1, 'available'),
('202', 2, 'double', 2, 'available')
ON CONFLICT (room_number) DO NOTHING;

-- Insert sample room requests
INSERT INTO room_requests (user_id, preferred_room_type, status, urgency_level, notes) VALUES
(gen_random_uuid(), 'single', 'pending', 'medium', 'Sample room request 1'),
(gen_random_uuid(), 'double', 'pending', 'high', 'Sample room request 2'),
(gen_random_uuid(), 'triple', 'pending', 'low', 'Sample room request 3')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFY TABLES WERE CREATED
-- ============================================================================
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('cleaning_requests', 'room_requests', 'leave_requests', 'complaints', 'rooms', 'users', 'user_profiles')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- SHOW TABLE COUNTS
-- ============================================================================
SELECT 
    'cleaning_requests' as table_name, COUNT(*) as record_count FROM cleaning_requests
UNION ALL
SELECT 
    'room_requests' as table_name, COUNT(*) as record_count FROM room_requests
UNION ALL
SELECT 
    'leave_requests' as table_name, COUNT(*) as record_count FROM leave_requests
UNION ALL
SELECT 
    'complaints' as table_name, COUNT(*) as record_count FROM complaints
UNION ALL
SELECT 
    'rooms' as table_name, COUNT(*) as record_count FROM rooms
UNION ALL
SELECT 
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 
    'user_profiles' as table_name, COUNT(*) as record_count FROM user_profiles;
