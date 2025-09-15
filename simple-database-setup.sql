-- =====================================================
-- SIMPLE HOSTELHAVEN DATABASE SETUP
-- =====================================================
-- Run this after adding the missing columns with add-columns.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREATE TABLES (IF NOT EXISTS)
-- =====================================================

-- Hostels table
CREATE TABLE IF NOT EXISTS hostels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    location TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    room_types VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    capacity INTEGER DEFAULT 0,
    current_occupancy INTEGER DEFAULT 0,
    amenities TEXT[],
    rules TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    floor INTEGER,
    room_type VARCHAR(50) DEFAULT 'standard' CHECK (room_type IN ('standard', 'deluxe', 'premium', 'suite')),
    capacity INTEGER DEFAULT 1,
    current_occupancy INTEGER DEFAULT 0,
    rent_amount DECIMAL(10,2),
    amenities TEXT[],
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hostel_id, room_number)
);

-- Room requests table
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'waitlisted', 'cancelled', 'expired')),
    priority_score INTEGER DEFAULT 0,
    preferred_room_type VARCHAR(50),
    preferred_floor INTEGER,
    special_requirements TEXT,
    allocated_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    allocated_at TIMESTAMP WITH TIME ZONE,
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waitlist_position INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room allocations table
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    allocation_type VARCHAR(20) DEFAULT 'automatic' CHECK (allocation_type IN ('automatic', 'manual', 'transfer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room waitlist table
CREATE TABLE IF NOT EXISTS room_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_request_id UUID NOT NULL REFERENCES room_requests(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    preferred_room_type VARCHAR(50),
    priority_score INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, room_request_id)
);

-- Allocation batches table
CREATE TABLE IF NOT EXISTS allocation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_requests INTEGER DEFAULT 0,
    allocated_count INTEGER DEFAULT 0,
    waitlisted_count INTEGER DEFAULT 0,
    errors TEXT[],
    run_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. ADD FOREIGN KEY CONSTRAINTS TO USERS TABLE
-- =====================================================

-- Add foreign key constraints (only if columns exist)
DO $$ 
BEGIN
    -- Check if hostel_id column exists and add constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'hostel_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_users_hostel' AND table_name = 'users') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL;
        END IF;
    END IF;
    
    -- Check if room_id column exists and add constraint
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'room_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_users_room' AND table_name = 'users') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- Basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_allocations_user_id ON room_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);

-- =====================================================
-- 4. SAMPLE DATA
-- =====================================================

-- Insert sample hostel
INSERT INTO hostels (name, address, location, city, state, pincode, room_types, contact_phone, contact_email, capacity, amenities, rules) 
VALUES (
    'Hostel Haven Main Campus',
    '123 University Road, Tech Park',
    'Near University Gate',
    'Bangalore',
    'Karnataka',
    '560001',
    'standard,deluxe,premium,suite',
    '+91-9876543210',
    'admin@hostelhaven.com',
    100,
    ARRAY['WiFi', 'Laundry', 'Cafeteria', 'Gym', 'Library'],
    ARRAY['No smoking', 'Quiet hours 10PM-6AM', 'No pets', 'Guest registration required']
) ON CONFLICT DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (hostel_id, room_number, floor, room_type, capacity, rent_amount, amenities) 
SELECT 
    h.id,
    room_data.room_number,
    room_data.floor,
    room_data.room_type,
    room_data.capacity,
    room_data.rent_amount,
    room_data.amenities
FROM hostels h
CROSS JOIN (VALUES 
    ('101', 1, 'standard', 2, 5000, ARRAY['AC', 'WiFi', 'Furniture']),
    ('102', 1, 'standard', 2, 5000, ARRAY['AC', 'WiFi', 'Furniture']),
    ('103', 1, 'deluxe', 1, 7500, ARRAY['AC', 'WiFi', 'Furniture', 'Private Bathroom']),
    ('201', 2, 'standard', 2, 5000, ARRAY['AC', 'WiFi', 'Furniture']),
    ('202', 2, 'standard', 2, 5000, ARRAY['AC', 'WiFi', 'Furniture']),
    ('203', 2, 'premium', 1, 10000, ARRAY['AC', 'WiFi', 'Furniture', 'Private Bathroom', 'Balcony']),
    ('301', 3, 'standard', 2, 5000, ARRAY['AC', 'WiFi', 'Furniture']),
    ('302', 3, 'suite', 1, 15000, ARRAY['AC', 'WiFi', 'Furniture', 'Private Bathroom', 'Balcony', 'Kitchenette'])
) AS room_data(room_number, floor, room_type, capacity, rent_amount, amenities)
WHERE h.name = 'Hostel Haven Main Campus'
ON CONFLICT (hostel_id, room_number) DO NOTHING;

-- =====================================================
-- 5. SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'HOSTELHAVEN DATABASE SETUP COMPLETED!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created Tables: 6';
    RAISE NOTICE 'Created Indexes: 7';
    RAISE NOTICE 'Added Sample Data: Hostel + 8 Rooms';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'You can now:';
    RAISE NOTICE '1. Add more hostels and rooms';
    RAISE NOTICE '2. Register students';
    RAISE NOTICE '3. Run room allocation';
    RAISE NOTICE '=====================================================';
END $$;
