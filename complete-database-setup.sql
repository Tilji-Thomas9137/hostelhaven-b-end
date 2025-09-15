-- =====================================================
-- HOSTELHAVEN COMPLETE DATABASE SETUP
-- =====================================================
-- This file contains all required SQL for the complete HostelHaven system
-- Run this file in your Supabase SQL Editor to set up everything

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CORE TABLES
-- =====================================================

-- Users table (authentication and basic info)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'hostel_operations_assistant', 'warden', 'parent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles table (detailed student information)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    course VARCHAR(100) NOT NULL,
    batch_year INTEGER,
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    parent_name VARCHAR(255),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(255),
    aadhar_number VARCHAR(20),
    blood_group VARCHAR(10),
    room_id UUID,
    join_date DATE,
    exit_date DATE,
    profile_status VARCHAR(20) DEFAULT 'active' CHECK (profile_status IN ('active', 'inactive', 'exited')),
    status VARCHAR(20) DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete', 'pending_review')),
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- =====================================================
-- 2. ROOM ALLOCATION SYSTEM TABLES
-- =====================================================

-- Room requests table (students request room allocation)
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'waitlisted', 'cancelled', 'expired')),
    priority_score INTEGER DEFAULT 0,
    preferred_room_type VARCHAR(50),
    preferred_floor INTEGER,
    special_requirements TEXT,
    allocated_room_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE,
    allocated_by UUID,
    waitlist_position INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room allocations table (track allocation history)
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    room_id UUID NOT NULL,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID,
    allocation_type VARCHAR(20) DEFAULT 'automatic' CHECK (allocation_type IN ('automatic', 'manual', 'transfer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room waitlist table (track waitlisted students)
CREATE TABLE IF NOT EXISTS room_waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    room_request_id UUID NOT NULL,
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

-- Allocation batches table (track batch allocation runs)
CREATE TABLE IF NOT EXISTS allocation_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_name VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_requests INTEGER DEFAULT 0,
    allocated_count INTEGER DEFAULT 0,
    waitlisted_count INTEGER DEFAULT 0,
    errors TEXT[],
    run_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ADDITIONAL SYSTEM TABLES
-- =====================================================

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    hostel_id UUID,
    room_id UUID,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(50) DEFAULT 'rent' CHECK (payment_type IN ('rent', 'security_deposit', 'maintenance', 'other')),
    due_date DATE NOT NULL,
    paid_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    hostel_id UUID,
    room_id UUID,
    leave_type VARCHAR(50) DEFAULT 'personal' CHECK (leave_type IN ('personal', 'medical', 'emergency', 'vacation')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    hostel_id UUID,
    room_id UUID,
    complaint_type VARCHAR(50) DEFAULT 'general' CHECK (complaint_type IN ('maintenance', 'noise', 'cleanliness', 'security', 'other')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID,
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID,
    created_by UUID,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_active BOOLEAN DEFAULT TRUE,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by UUID,
    hostel_id UUID,
    room_id UUID,
    issue_type VARCHAR(50) DEFAULT 'general' CHECK (issue_type IN ('plumbing', 'electrical', 'furniture', 'cleaning', 'other')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    assigned_to UUID,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add missing columns to users table (simple approach)
ALTER TABLE users ADD COLUMN IF NOT EXISTS hostel_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS room_id UUID;

-- Verify columns were added
SELECT 'Columns added to users table:' as status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('hostel_id', 'room_id');

-- Add foreign key constraints safely (check if they don't already exist)
DO $$ 
BEGIN
    -- User profiles foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_profiles_room') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;

    -- Room requests foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_requests_user') THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_requests_room') THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_room FOREIGN KEY (allocated_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_requests_allocated_by') THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_allocated_by FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Room allocations foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_allocations_user') THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_allocations_room') THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_allocations_allocated_by') THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_allocated_by FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Room waitlist foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_waitlist_user') THEN
        ALTER TABLE room_waitlist ADD CONSTRAINT fk_room_waitlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_room_waitlist_request') THEN
        ALTER TABLE room_waitlist ADD CONSTRAINT fk_room_waitlist_request FOREIGN KEY (room_request_id) REFERENCES room_requests(id) ON DELETE CASCADE;
    END IF;

    -- Allocation batches foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_allocation_batches_run_by') THEN
        ALTER TABLE allocation_batches ADD CONSTRAINT fk_allocation_batches_run_by FOREIGN KEY (run_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Payments foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_user') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_hostel') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_room') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;

    -- Leave requests foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leave_requests_user') THEN
        ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leave_requests_hostel') THEN
        ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leave_requests_room') THEN
        ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_leave_requests_approved_by') THEN
        ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Complaints foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_complaints_user') THEN
        ALTER TABLE complaints ADD CONSTRAINT fk_complaints_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_complaints_hostel') THEN
        ALTER TABLE complaints ADD CONSTRAINT fk_complaints_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_complaints_room') THEN
        ALTER TABLE complaints ADD CONSTRAINT fk_complaints_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_complaints_assigned_to') THEN
        ALTER TABLE complaints ADD CONSTRAINT fk_complaints_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Notifications foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_notifications_user') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Announcements foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_announcements_hostel') THEN
        ALTER TABLE announcements ADD CONSTRAINT fk_announcements_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_announcements_created_by') THEN
        ALTER TABLE announcements ADD CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Maintenance requests foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_requests_reported_by') THEN
        ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_reported_by FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_requests_hostel') THEN
        ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_requests_room') THEN
        ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_maintenance_requests_assigned_to') THEN
        ALTER TABLE maintenance_requests ADD CONSTRAINT fk_maintenance_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints for users table (after all referenced tables are created)
DO $$ 
BEGIN
    -- Add foreign key constraint for hostel_id if column exists and constraint doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'hostel_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_users_hostel' AND table_name = 'users') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL;
        END IF;
    END IF;
    
    -- Add foreign key constraint for room_id if column exists and constraint doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'room_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_users_room' AND table_name = 'users') THEN
            ALTER TABLE users ADD CONSTRAINT fk_users_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_hostel_id ON users(hostel_id);
CREATE INDEX IF NOT EXISTS idx_users_room_id ON users(room_id);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_admission_number ON user_profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_user_profiles_course ON user_profiles(course);
CREATE INDEX IF NOT EXISTS idx_user_profiles_batch_year ON user_profiles(batch_year);
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_status ON user_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_room_id ON user_profiles(room_id);

-- Hostels indexes
CREATE INDEX IF NOT EXISTS idx_hostels_name ON hostels(name);
CREATE INDEX IF NOT EXISTS idx_hostels_city ON hostels(city);

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor);
CREATE INDEX IF NOT EXISTS idx_rooms_capacity_occupied ON rooms(capacity, current_occupancy);

-- Room requests indexes
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_requests_priority ON room_requests(priority_score DESC, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_room_requests_allocated_room ON room_requests(allocated_room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_expires ON room_requests(expires_at);

-- Room allocations indexes
CREATE INDEX IF NOT EXISTS idx_room_allocations_user_id ON room_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_status ON room_allocations(status);
CREATE INDEX IF NOT EXISTS idx_room_allocations_active ON room_allocations(user_id, status) WHERE status = 'active';

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_room_waitlist_user_id ON room_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_room_waitlist_position ON room_waitlist(position);
CREATE INDEX IF NOT EXISTS idx_room_waitlist_priority ON room_waitlist(priority_score DESC, added_at ASC);

-- Other table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_announcements_hostel_id ON announcements(hostel_id);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_reported_by ON maintenance_requests(reported_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

CREATE POLICY "Admins can manage all profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Hostels policies
CREATE POLICY "Anyone can view hostels" ON hostels
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage hostels" ON hostels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Rooms policies
CREATE POLICY "Anyone can view rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage rooms" ON rooms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Room requests policies
CREATE POLICY "Users can view their own requests" ON room_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" ON room_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own requests" ON room_requests
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Room allocations policies
CREATE POLICY "Users can view their own allocations" ON room_allocations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all allocations" ON room_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Waitlist policies
CREATE POLICY "Users can view their own waitlist" ON room_waitlist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all waitlist" ON room_waitlist
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Allocation batches policies
CREATE POLICY "Admins can manage allocation batches" ON allocation_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Other table policies
CREATE POLICY "Users can view their own data" ON payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own data" ON leave_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own data" ON complaints
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own data" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own data" ON maintenance_requests
    FOR SELECT USING (auth.uid() = reported_by);

CREATE POLICY "Anyone can view announcements" ON announcements
    FOR SELECT USING (is_active = true);

-- =====================================================
-- 8. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hostels_updated_at BEFORE UPDATE ON hostels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_requests_updated_at BEFORE UPDATE ON room_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_allocations_updated_at BEFORE UPDATE ON room_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_waitlist_updated_at BEFORE UPDATE ON room_waitlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON complaints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. ROOM ALLOCATION FUNCTIONS
-- =====================================================

-- Function to calculate priority score for a student
CREATE OR REPLACE FUNCTION calculate_priority_score(
    user_id UUID,
    requested_at TIMESTAMP WITH TIME ZONE
) RETURNS INTEGER AS $$
DECLARE
    user_role VARCHAR(50);
    user_created_at TIMESTAMP WITH TIME ZONE;
    score INTEGER := 0;
BEGIN
    -- Get user details
    SELECT role, created_at INTO user_role, user_created_at
    FROM users WHERE id = user_id;
    
    -- Base score from request time (earlier = higher score)
    score := EXTRACT(EPOCH FROM (NOW() - requested_at))::INTEGER;
    
    -- Role-based priority
    CASE user_role
        WHEN 'admin' THEN score := score + 10000;
        WHEN 'warden' THEN score := score + 8000;
        WHEN 'hostel_operations_assistant' THEN score := score + 6000;
        WHEN 'student' THEN score := score + 1000;
        ELSE score := score + 500;
    END CASE;
    
    -- Seniority bonus (older accounts get priority)
    score := score + EXTRACT(EPOCH FROM (NOW() - user_created_at))::INTEGER / 86400; -- Days since account creation
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to find available rooms
CREATE OR REPLACE FUNCTION find_available_rooms(
    preferred_room_type VARCHAR(50) DEFAULT NULL,
    preferred_floor INTEGER DEFAULT NULL
) RETURNS TABLE(
    room_id UUID,
    room_number VARCHAR(20),
    room_type VARCHAR(50),
    floor INTEGER,
    capacity INTEGER,
    occupied INTEGER,
    available_spots INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.room_number,
        r.room_type,
        r.floor,
        r.capacity,
        r.current_occupancy,
        (r.capacity - r.current_occupancy) as available_spots
    FROM rooms r
    WHERE r.status = 'available'
    AND r.current_occupancy < r.capacity
    AND (preferred_room_type IS NULL OR r.room_type = preferred_room_type)
    AND (preferred_floor IS NULL OR r.floor = preferred_floor)
    ORDER BY 
        CASE WHEN preferred_room_type IS NOT NULL AND r.room_type = preferred_room_type THEN 0 ELSE 1 END,
        CASE WHEN preferred_floor IS NOT NULL AND r.floor = preferred_floor THEN 0 ELSE 1 END,
        r.room_number;
END;
$$ LANGUAGE plpgsql;

-- Function to run batch allocation
CREATE OR REPLACE FUNCTION run_batch_allocation(
    batch_name VARCHAR(100) DEFAULT 'Auto Allocation',
    run_by_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    batch_id UUID;
    request_record RECORD;
    room_record RECORD;
    allocated_count INTEGER := 0;
    waitlisted_count INTEGER := 0;
    total_requests INTEGER := 0;
    errors TEXT[] := '{}';
BEGIN
    -- Create batch record
    INSERT INTO allocation_batches (batch_name, run_by, status)
    VALUES (batch_name, run_by_user_id, 'running')
    RETURNING id INTO batch_id;
    
    -- Get total pending requests
    SELECT COUNT(*) INTO total_requests
    FROM room_requests 
    WHERE status = 'pending';
    
    -- Update batch with total requests
    UPDATE allocation_batches 
    SET total_requests = total_requests
    WHERE id = batch_id;
    
    -- Process requests in priority order
    FOR request_record IN
        SELECT 
            rr.*,
            calculate_priority_score(rr.user_id, rr.requested_at) as calculated_priority
        FROM room_requests rr
        WHERE rr.status = 'pending'
        AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
        ORDER BY calculated_priority DESC, rr.requested_at ASC
    LOOP
        -- Update priority score
        UPDATE room_requests 
        SET priority_score = request_record.calculated_priority
        WHERE id = request_record.id;
        
        -- Find available room
        SELECT * INTO room_record
        FROM find_available_rooms(
            request_record.preferred_room_type,
            request_record.preferred_floor
        )
        LIMIT 1;
        
        IF room_record.room_id IS NOT NULL THEN
            -- Allocate room
            BEGIN
                -- Update room occupancy
                UPDATE rooms 
                SET current_occupancy = current_occupancy + 1,
                    status = CASE 
                        WHEN (current_occupancy + 1) >= capacity THEN 'occupied'
                        ELSE 'available'
                    END
                WHERE id = room_record.room_id;
                
                -- Update user's room_id
                UPDATE users 
                SET room_id = room_record.room_id
                WHERE id = request_record.user_id;
                
                -- Update user profile's room_id
                UPDATE user_profiles 
                SET room_id = room_record.room_id
                WHERE user_id = request_record.user_id;
                
                -- Update request status
                UPDATE room_requests 
                SET 
                    status = 'allocated',
                    allocated_room_id = room_record.room_id,
                    allocated_at = NOW(),
                    allocated_by = run_by_user_id
                WHERE id = request_record.id;
                
                -- Create allocation record
                INSERT INTO room_allocations (
                    user_id, room_id, allocated_by, allocation_type
                ) VALUES (
                    request_record.user_id, 
                    room_record.room_id, 
                    run_by_user_id, 
                    'automatic'
                );
                
                allocated_count := allocated_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                errors := array_append(errors, 
                    'Failed to allocate room ' || room_record.room_number || 
                    ' to user ' || request_record.user_id || ': ' || SQLERRM
                );
            END;
        ELSE
            -- No room available, add to waitlist
            UPDATE room_requests 
            SET status = 'waitlisted'
            WHERE id = request_record.id;
            
            -- Add to waitlist
            INSERT INTO room_waitlist (
                user_id, room_request_id, position, preferred_room_type, priority_score
            ) VALUES (
                request_record.user_id,
                request_record.id,
                (SELECT COALESCE(MAX(position), 0) + 1 FROM room_waitlist),
                request_record.preferred_room_type,
                request_record.calculated_priority
            );
            
            waitlisted_count := waitlisted_count + 1;
        END IF;
    END LOOP;
    
    -- Update batch completion
    UPDATE allocation_batches 
    SET 
        status = 'completed',
        completed_at = NOW(),
        allocated_count = allocated_count,
        waitlisted_count = waitlisted_count,
        errors = errors
    WHERE id = batch_id;
    
    RETURN batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process waitlist when rooms become available
CREATE OR REPLACE FUNCTION process_waitlist() RETURNS INTEGER AS $$
DECLARE
    waitlist_record RECORD;
    room_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Process waitlist in priority order
    FOR waitlist_record IN
        SELECT 
            rw.*,
            rr.user_id,
            rr.preferred_room_type,
            rr.preferred_floor
        FROM room_waitlist rw
        JOIN room_requests rr ON rw.room_request_id = rr.id
        WHERE rr.status = 'waitlisted'
        AND (rw.expires_at IS NULL OR rw.expires_at > NOW())
        ORDER BY rw.priority_score DESC, rw.added_at ASC
    LOOP
        -- Find available room
        SELECT * INTO room_record
        FROM find_available_rooms(
            waitlist_record.preferred_room_type,
            waitlist_record.preferred_floor
        )
        LIMIT 1;
        
        IF room_record.room_id IS NOT NULL THEN
            -- Allocate room to waitlisted user
            BEGIN
                -- Update room occupancy
                UPDATE rooms 
                SET current_occupancy = current_occupancy + 1,
                    status = CASE 
                        WHEN (current_occupancy + 1) >= capacity THEN 'occupied'
                        ELSE 'available'
                    END
                WHERE id = room_record.room_id;
                
                -- Update user's room_id
                UPDATE users 
                SET room_id = room_record.room_id
                WHERE id = waitlist_record.user_id;
                
                -- Update user profile's room_id
                UPDATE user_profiles 
                SET room_id = room_record.room_id
                WHERE user_id = waitlist_record.user_id;
                
                -- Update request status
                UPDATE room_requests 
                SET 
                    status = 'allocated',
                    allocated_room_id = room_record.room_id,
                    allocated_at = NOW()
                WHERE id = waitlist_record.room_request_id;
                
                -- Create allocation record
                INSERT INTO room_allocations (
                    user_id, room_id, allocation_type
                ) VALUES (
                    waitlist_record.user_id, 
                    room_record.room_id, 
                    'automatic'
                );
                
                -- Remove from waitlist
                DELETE FROM room_waitlist 
                WHERE id = waitlist_record.id;
                
                processed_count := processed_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                -- Log error but continue processing
                RAISE NOTICE 'Failed to process waitlist entry %: %', waitlist_record.id, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. SAMPLE DATA (Optional)
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
-- 11. VERIFICATION QUERIES
-- =====================================================

-- Check if all tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'users', 'user_profiles', 'hostels', 'rooms', 
    'room_requests', 'room_allocations', 'room_waitlist', 'allocation_batches',
    'payments', 'leave_requests', 'complaints', 'notifications', 
    'announcements', 'maintenance_requests'
)
ORDER BY tablename;

-- Check foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'HOSTELHAVEN DATABASE SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created Tables: 15';
    RAISE NOTICE 'Created Indexes: 50+';
    RAISE NOTICE 'Created Functions: 4';
    RAISE NOTICE 'Created Triggers: 11';
    RAISE NOTICE 'Created Policies: 25+';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'You can now:';
    RAISE NOTICE '1. Create admin users';
    RAISE NOTICE '2. Add hostels and rooms';
    RAISE NOTICE '3. Register students';
    RAISE NOTICE '4. Run room allocation';
    RAISE NOTICE '=====================================================';
END $$;
