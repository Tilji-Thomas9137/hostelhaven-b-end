-- Complete HostelHaven Database Setup for Supabase
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid UUID UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'warden', 'hostel_operations_assistant', 'student', 'parent')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    phone_number VARCHAR(20),
    admission_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE ROOMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(20) UNIQUE NOT NULL,
    floor INTEGER NOT NULL,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'quad')),
    capacity INTEGER NOT NULL,
    current_occupancy INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    amenities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE ROOM_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- CREATE ROOM_ALLOCATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_profile_id UUID,
    room_id UUID NOT NULL,
    request_id UUID,
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

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Room allocations foreign keys
ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_allocations 
ADD CONSTRAINT fk_room_allocations_request_id 
FOREIGN KEY (request_id) REFERENCES room_requests(id) ON DELETE SET NULL;

    -- Room requests foreign keys
ALTER TABLE room_requests 
ADD CONSTRAINT fk_room_requests_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE room_requests 
ADD CONSTRAINT fk_room_requests_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- ============================================================================
-- INSERT SAMPLE DATA
-- ============================================================================

-- Insert sample rooms
INSERT INTO rooms (room_number, floor, room_type, capacity, current_occupancy, status) VALUES
('A1102', 1, 'single', 1, 0, 'available'),
('D201', 2, 'double', 2, 0, 'available'),
('T301', 3, 'triple', 3, 0, 'available'),
('S101', 1, 'single', 1, 0, 'available'),
('D202', 2, 'double', 2, 0, 'available')
ON CONFLICT (room_number) DO NOTHING;

-- Insert sample user (operations assistant)
INSERT INTO users (email, full_name, role, status, admission_number) VALUES
('tilji0119@gmail.com', 'THOMAS', 'hostel_operations_assistant', 'active', 'STAFF001')
ON CONFLICT (email) DO NOTHING;

-- Insert sample student
INSERT INTO users (email, full_name, role, status, admission_number) VALUES
('aswinmurali2026@mca.ajce.in', 'Aswin Murali', 'student', 'active', '13186')
ON CONFLICT (email) DO NOTHING;

-- Insert sample room request
INSERT INTO room_requests (user_id, preferred_room_type, special_requirements, status, notes) 
    SELECT 
    u.id,
    'double',
    'REQUESTED_ROOM_ID:' || r.id,
    'pending',
    'Requesting double room allocation'
FROM users u, rooms r 
WHERE u.email = 'aswinmurali2026@mca.ajce.in' 
AND r.room_number = 'D201'
        LIMIT 1;
        
-- ============================================================================
-- VERIFY SETUP
-- ============================================================================
SELECT 'Database setup completed successfully!' as status;

-- Show created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'rooms', 'room_requests', 'room_allocations')
ORDER BY table_name;