-- HostelHaven Database Migration
-- Date: 2025-01-15
-- Purpose: Implement secure admission registry, parent verification, capacity-aware room allocation, and proper RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PENDING DATA REVIEW TABLE
-- ============================================================================
-- Create a table for data that needs manual review (needed early for cleanup)
CREATE TABLE IF NOT EXISTS pending_data_review (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    issue_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- ADMISSION REGISTRY TABLE
-- ============================================================================
-- Authoritative source for student admissions - only staff can create students
CREATE TABLE IF NOT EXISTS admission_registry (
    admission_number VARCHAR(50) PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    course VARCHAR(100) NOT NULL,
    batch_year INTEGER NOT NULL,
    parent_name VARCHAR(255) NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_relation VARCHAR(50),
    student_email VARCHAR(255),
    student_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'inactive', 'rejected')),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PARENTS TABLE
-- ============================================================================
-- Parent accounts with OTP verification
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- UPDATE USERS TABLE
-- ============================================================================
-- Add auth_uid column to map Supabase auth users to our users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- Remove hostel_id references for single hostel system
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_hostel;
ALTER TABLE users DROP COLUMN IF EXISTS hostel_id;

-- ============================================================================
-- UPDATE USER_PROFILES TABLE
-- ============================================================================
-- Make admission_number reference admission_registry and non-editable by students
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS admission_number_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS parent_contact_locked BOOLEAN DEFAULT TRUE;

-- Clean up orphaned admission_numbers before adding foreign key constraint
-- First, flag problematic records for review
INSERT INTO pending_data_review (table_name, record_id, issue_description)
SELECT 
    'user_profiles',
    up.id,
    'User profile has admission_number not in admission_registry: ' || up.admission_number
FROM user_profiles up
LEFT JOIN admission_registry ar ON up.admission_number = ar.admission_number
WHERE ar.admission_number IS NULL
AND up.admission_number IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM pending_data_review pdr 
    WHERE pdr.table_name = 'user_profiles' 
    AND pdr.record_id = up.id
);

-- Make admission_number nullable temporarily to allow cleanup
ALTER TABLE user_profiles ALTER COLUMN admission_number DROP NOT NULL;

-- Temporarily set orphaned admission_numbers to NULL to allow constraint creation
UPDATE user_profiles 
SET admission_number = NULL 
WHERE admission_number IS NOT NULL 
AND admission_number NOT IN (SELECT admission_number FROM admission_registry);

-- Now add the foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_profiles_admission_registry' 
        AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_admission_registry 
            FOREIGN KEY (admission_number) REFERENCES admission_registry(admission_number);
    END IF;
END $$;

-- Note: admission_number remains nullable to allow for user profiles without admission registry entries
-- This is intentional as some profiles may exist before admission registry is populated

-- ============================================================================
-- UPDATE ROOMS TABLE
-- ============================================================================
-- Convert room types to single/double/triple and add capacity management
-- Remove hostel_id references for single hostel system
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS fk_rooms_hostel;
ALTER TABLE rooms DROP COLUMN IF EXISTS hostel_id;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_code VARCHAR(20);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;

-- Drop existing status constraint first
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

-- Update existing room status values to match new constraint
UPDATE rooms SET status = 
    CASE 
        WHEN status = 'occupied' THEN 'partially_filled'
        WHEN status = 'reserved' THEN 'available'
        WHEN status NOT IN ('available', 'partially_filled', 'full', 'maintenance') THEN 'available'
        ELSE status
    END;

-- Now add the new constraint
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('available', 'partially_filled', 'full', 'maintenance'));

-- Update room_type enum to only include single/double/triple
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;

-- First, update room types to valid values before adding constraint
UPDATE rooms SET room_type = 
    CASE 
        WHEN room_type IN ('standard', 'basic', 'single_occupancy') THEN 'single'
        WHEN room_type IN ('deluxe', 'premium', 'double_occupancy') THEN 'double'
        WHEN room_type IN ('suite', 'family', 'triple_occupancy') THEN 'triple'
        WHEN room_type IS NULL OR room_type = '' THEN 'single'
        ELSE 'single'  -- Default fallback for any other values
    END;

-- Now add the constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'rooms_room_type_check' 
        AND table_name = 'rooms'
    ) THEN
        ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check CHECK (room_type IN ('single', 'double', 'triple'));
    END IF;
END $$;

-- Update capacity based on room type
UPDATE rooms SET capacity = 
    CASE 
        WHEN room_type = 'single' THEN 1
        WHEN room_type = 'double' THEN 2
        WHEN room_type = 'triple' THEN 3
        ELSE 1
    END
WHERE capacity IS NULL OR capacity = 0;

-- ============================================================================
-- ROOM REQUESTS TABLE
-- ============================================================================
-- Create table without foreign key constraints first to avoid circular dependencies
DROP TABLE IF EXISTS room_requests CASCADE;
CREATE TABLE room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID,
    room_id UUID,
    request_type VARCHAR(20) DEFAULT 'allocation' CHECK (request_type IN ('allocation', 'change')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    priority INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key constraints will be added later after all tables are created

-- ============================================================================
-- ROOM ALLOCATIONS TABLE
-- ============================================================================
-- Create table without foreign key constraints first to avoid circular dependencies
DROP TABLE IF EXISTS room_allocations CASCADE;
CREATE TABLE room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID,
    room_id UUID,
    allocation_status VARCHAR(20) DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
    allocation_date DATE DEFAULT CURRENT_DATE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key constraints will be added later after all tables are created

-- ============================================================================
-- PARCELS TABLE
-- ============================================================================
-- Create table without foreign key constraints first to avoid circular dependencies
DROP TABLE IF EXISTS parcels CASCADE;
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID,
    parcel_name VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_phone VARCHAR(20),
    token VARCHAR(255) UNIQUE NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key constraints will be added later after all tables are created

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================
-- Create table without foreign key constraints first to avoid circular dependencies
DROP TABLE IF EXISTS feedback CASCADE;
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID,
    feedback_type VARCHAR(20) DEFAULT 'mess' CHECK (feedback_type IN ('mess', 'general', 'facilities')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    text_content TEXT,
    sentiment_label VARCHAR(20),
    sentiment_score DECIMAL(3,2),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
-- Payment tracking for hostel rent and other fees
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('room_rent', 'mess_fee', 'maintenance_fee', 'security_deposit', 'other')),
    payment_method VARCHAR(50) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'online', 'cheque')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    transaction_reference VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- LEAVE REQUESTS TABLE (Outpass System)
-- ============================================================================
-- Students can request permission to leave the hostel
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('emergency', 'medical', 'personal', 'vacation', 'academic')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    departure_time TIME,
    return_time TIME,
    destination VARCHAR(255),
    reason TEXT NOT NULL,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    outpass_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COMPLAINTS TABLE
-- ============================================================================
-- Students can submit complaints about facilities, maintenance, or general issues
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('maintenance', 'security', 'cleanliness', 'noise', 'food', 'facilities', 'general')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed', 'rejected')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key constraints will be added later after all tables are created

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admission_registry_student_name ON admission_registry(student_name);
CREATE INDEX IF NOT EXISTS idx_admission_registry_course ON admission_registry(course);
CREATE INDEX IF NOT EXISTS idx_admission_registry_batch_year ON admission_registry(batch_year);
CREATE INDEX IF NOT EXISTS idx_admission_registry_parent_email ON admission_registry(parent_email);

CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_student_profile_id ON parents(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);
CREATE INDEX IF NOT EXISTS idx_parents_verified ON parents(verified);

CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_rooms_current_occupancy ON rooms(current_occupancy);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);

CREATE INDEX IF NOT EXISTS idx_room_requests_student_profile_id ON room_requests(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_room_id ON room_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);

CREATE INDEX IF NOT EXISTS idx_room_allocations_student_profile_id ON room_allocations(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_allocation_status ON room_allocations(allocation_status);

CREATE INDEX IF NOT EXISTS idx_parcels_student_profile_id ON parcels(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_parcels_token ON parcels(token);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);

CREATE INDEX IF NOT EXISTS idx_feedback_student_profile_id ON feedback(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment_label ON feedback(sentiment_label);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type ON leave_requests(leave_type);

CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);

-- ============================================================================
-- CREATE FUNCTIONS
-- ============================================================================

-- Function to update room occupancy
CREATE OR REPLACE FUNCTION update_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update current_occupancy based on active allocations
    UPDATE rooms 
    SET current_occupancy = (
        SELECT COUNT(*) 
        FROM room_allocations 
        WHERE room_id = NEW.room_id 
        AND allocation_status IN ('confirmed', 'active')
    ),
    status = CASE 
        WHEN current_occupancy + 1 >= capacity THEN 'full'
        WHEN current_occupancy + 1 > 0 THEN 'partially_filled'
        ELSE 'available'
    END
    WHERE id = NEW.room_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_admission_registry_updated_at ON admission_registry;
CREATE TRIGGER update_admission_registry_updated_at 
    BEFORE UPDATE ON admission_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parents_updated_at ON parents;
CREATE TRIGGER update_parents_updated_at 
    BEFORE UPDATE ON parents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_requests_updated_at ON room_requests;
CREATE TRIGGER update_room_requests_updated_at 
    BEFORE UPDATE ON room_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_allocations_updated_at ON room_allocations;
CREATE TRIGGER update_room_allocations_updated_at 
    BEFORE UPDATE ON room_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parcels_updated_at ON parcels;
CREATE TRIGGER update_parcels_updated_at 
    BEFORE UPDATE ON parcels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at 
    BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update room occupancy when allocations change
DROP TRIGGER IF EXISTS update_room_occupancy_trigger ON room_allocations;
CREATE TRIGGER update_room_occupancy_trigger
    AFTER INSERT OR UPDATE OR DELETE ON room_allocations
    FOR EACH ROW EXECUTE FUNCTION update_room_occupancy();

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE admission_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Admission Registry: Only staff can view and manage
DROP POLICY IF EXISTS "Staff can manage admission registry" ON admission_registry;
CREATE POLICY "Staff can manage admission registry" ON admission_registry
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Parents: Parents can view their own data when verified
DROP POLICY IF EXISTS "Parents can view own data when verified" ON parents;
CREATE POLICY "Parents can view own data when verified" ON parents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = parents.user_id
            AND parents.verified = true
        )
    );

-- Parents: Staff can manage all parent data
DROP POLICY IF EXISTS "Staff can manage parents" ON parents;
CREATE POLICY "Staff can manage parents" ON parents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Room Requests: Students can create and view their own requests
DROP POLICY IF EXISTS "Students can manage own room requests" ON room_requests;
CREATE POLICY "Students can manage own room requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            WHERE u.auth_uid = auth.uid() 
            AND up.id = room_requests.student_profile_id
        )
    );

-- Room Requests: Staff can view and manage all requests
DROP POLICY IF EXISTS "Staff can manage all room requests" ON room_requests;
CREATE POLICY "Staff can manage all room requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Room Allocations: Students can view their own allocations
DROP POLICY IF EXISTS "Students can view own allocations" ON room_allocations;
CREATE POLICY "Students can view own allocations" ON room_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            WHERE u.auth_uid = auth.uid() 
            AND up.id = room_allocations.student_profile_id
        )
    );

-- Room Allocations: Staff can manage all allocations
DROP POLICY IF EXISTS "Staff can manage all allocations" ON room_allocations;
CREATE POLICY "Staff can manage all allocations" ON room_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Parcels: Students can view their own parcels
DROP POLICY IF EXISTS "Students can view own parcels" ON parcels;
CREATE POLICY "Students can view own parcels" ON parcels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            WHERE u.auth_uid = auth.uid() 
            AND up.id = parcels.student_profile_id
        )
    );

-- Parcels: Staff can manage all parcels
DROP POLICY IF EXISTS "Staff can manage all parcels" ON parcels;
CREATE POLICY "Staff can manage all parcels" ON parcels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Feedback: Students can create and view their own feedback
DROP POLICY IF EXISTS "Students can manage own feedback" ON feedback;
CREATE POLICY "Students can manage own feedback" ON feedback
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            WHERE u.auth_uid = auth.uid() 
            AND up.id = feedback.student_profile_id
        )
    );

-- Feedback: Staff can view all feedback
DROP POLICY IF EXISTS "Staff can view all feedback" ON feedback;
CREATE POLICY "Staff can view all feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- RLS POLICIES FOR PAYMENTS TABLE
-- ============================================================================

-- Payments: Students can view their own payments
DROP POLICY IF EXISTS "Students can view own payments" ON payments;
CREATE POLICY "Students can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = payments.user_id
        )
    );

-- Payments: Staff can manage all payments
DROP POLICY IF EXISTS "Staff can manage all payments" ON payments;
CREATE POLICY "Staff can manage all payments" ON payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- RLS POLICIES FOR LEAVE REQUESTS TABLE
-- ============================================================================

-- Leave Requests: Students can manage their own requests
DROP POLICY IF EXISTS "Students can manage own leave requests" ON leave_requests;
CREATE POLICY "Students can manage own leave requests" ON leave_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = leave_requests.user_id
        )
    );

-- Leave Requests: Staff can manage all requests
DROP POLICY IF EXISTS "Staff can manage all leave requests" ON leave_requests;
CREATE POLICY "Staff can manage all leave requests" ON leave_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- RLS POLICIES FOR COMPLAINTS TABLE
-- ============================================================================

-- Complaints: Students can manage their own complaints
DROP POLICY IF EXISTS "Students can manage own complaints" ON complaints;
CREATE POLICY "Students can manage own complaints" ON complaints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = complaints.user_id
        )
    );

-- Complaints: Staff can manage all complaints
DROP POLICY IF EXISTS "Staff can manage all complaints" ON complaints;
CREATE POLICY "Staff can manage all complaints" ON complaints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- REMOVE HOSTELS TABLE (Single Hostel System)
-- ============================================================================
-- For a single hostel system, remove the hostels table and related references

-- Drop hostels table and all related constraints
DROP TABLE IF EXISTS hostels CASCADE;

-- Remove hostel_id from other tables that might reference it (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
        ALTER TABLE announcements DROP CONSTRAINT IF EXISTS fk_announcements_hostel;
        ALTER TABLE announcements DROP COLUMN IF EXISTS hostel_id;
    END IF;
END $$;

-- ============================================================================
-- BACKFILL SECTION
-- ============================================================================

-- Note: Room types were already mapped earlier in the migration

-- Backfill capacity based on room type
UPDATE rooms SET capacity = 
    CASE 
        WHEN room_type = 'single' THEN 1
        WHEN room_type = 'double' THEN 2
        WHEN room_type = 'triple' THEN 3
        ELSE 1
    END
WHERE capacity IS NULL OR capacity = 0;

-- Backfill current_occupancy from existing room assignments
UPDATE rooms SET current_occupancy = (
    SELECT COUNT(*) 
    FROM users 
    WHERE users.room_id = rooms.id
);

-- Update room status based on occupancy
UPDATE rooms SET status = 
    CASE 
        WHEN current_occupancy >= capacity THEN 'full'
        WHEN current_occupancy > 0 THEN 'partially_filled'
        ELSE 'available'
    END;

-- Note: Orphaned admission_numbers were already flagged and cleaned up earlier in the migration

-- Create room_code if not exists
UPDATE rooms SET room_code = room_number WHERE room_code IS NULL;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample admission registry entries
INSERT INTO admission_registry (admission_number, student_name, course, batch_year, parent_name, parent_email, parent_phone, added_by)
VALUES 
    ('ADM001', 'John Doe', 'Computer Science', 2024, 'Jane Doe', 'jane.doe@email.com', '+1234567890', NULL),
    ('ADM002', 'Alice Smith', 'Engineering', 2024, 'Bob Smith', 'bob.smith@email.com', '+1234567891', NULL),
    ('ADM003', 'Charlie Brown', 'Business', 2024, 'Diana Brown', 'diana.brown@email.com', '+1234567892', NULL)
ON CONFLICT (admission_number) DO NOTHING;

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Add all foreign key constraints after all tables and modifications are complete

-- Room Requests foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_student_profile'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_student_profile 
            FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_room'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_room 
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Room Allocations foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_student_profile'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_student_profile 
            FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_room'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_room 
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_created_by'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Parcels foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_parcels_student_profile'
    ) THEN
        ALTER TABLE parcels ADD CONSTRAINT fk_parcels_student_profile 
            FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_parcels_claimed_by'
    ) THEN
        ALTER TABLE parcels ADD CONSTRAINT fk_parcels_claimed_by 
            FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Feedback foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_feedback_student_profile'
    ) THEN
        ALTER TABLE feedback ADD CONSTRAINT fk_feedback_student_profile 
            FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
INSERT INTO pending_data_review (table_name, record_id, issue_description, status)
VALUES ('migration', uuid_generate_v4(), 'HostelHaven schema migration completed successfully', 'resolved');
