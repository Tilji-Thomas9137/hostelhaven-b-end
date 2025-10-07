-- =====================================================
-- FIX MISSING SCHEMA FOR STUDENT PROFILE AND ROOM ALLOCATION
-- =====================================================
-- This file adds the missing schema elements needed for student profiles and room allocation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add auth_uid column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'auth_uid' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN auth_uid UUID;
        CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
    END IF;
END $$;

-- Add missing columns to users table
DO $$ 
BEGIN
    -- Add room_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'room_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN room_id UUID;
    END IF;
    
    -- Note: hostel_id column not needed for single hostel management
    
    -- Add status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'status' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
    END IF;
    
    -- Add username if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'username' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(100);
    END IF;
    
    -- Add activation_token if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'activation_token' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN activation_token VARCHAR(255);
    END IF;
    
    -- Add activation_expires_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'activation_expires_at' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN activation_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add otp_code if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'otp_code' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN otp_code VARCHAR(10);
    END IF;
    
    -- Add otp_expires_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'otp_expires_at' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add linked_admission_number if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'linked_admission_number' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users ADD COLUMN linked_admission_number VARCHAR(50);
    END IF;
END $$;

-- Add missing columns to user_profiles table
DO $$ 
BEGIN
    -- Add pincode if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'pincode' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN pincode VARCHAR(10);
    END IF;
    
    -- Add admission_number_verified if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'admission_number_verified' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN admission_number_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add parent_contact_locked if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'parent_contact_locked' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN parent_contact_locked BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add aadhar_front_url if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'aadhar_front_url' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN aadhar_front_url TEXT;
    END IF;
    
    -- Add aadhar_back_url if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'aadhar_back_url' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN aadhar_back_url TEXT;
    END IF;
END $$;

-- Add missing columns to rooms table
DO $$ 
BEGIN
    -- Add occupied column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' 
        AND column_name = 'occupied' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE rooms ADD COLUMN occupied INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add missing columns to room_requests table if it exists
DO $$ 
BEGIN
    -- Check if room_requests table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'room_requests' 
        AND table_schema = 'public'
    ) THEN
        -- Add missing columns to existing room_requests table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'student_profile_id' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN student_profile_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'room_id' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN room_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'request_type' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN request_type VARCHAR(50) DEFAULT 'allocation';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'priority_score' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN priority_score INTEGER DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'preferred_room_type' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN preferred_room_type VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'preferred_floor' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN preferred_floor INTEGER;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'special_requirements' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN special_requirements TEXT;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'notes' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN notes TEXT;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'requested_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'processed_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'processed_by' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN processed_by UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'created_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_requests' 
            AND column_name = 'updated_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_requests ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Add missing columns to room_allocations table if it exists
DO $$ 
BEGIN
    -- Check if room_allocations table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'room_allocations' 
        AND table_schema = 'public'
    ) THEN
        -- Add missing columns to existing room_allocations table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'student_profile_id' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN student_profile_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'room_id' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN room_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'allocation_status' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN allocation_status VARCHAR(20) DEFAULT 'pending';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'allocation_type' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN allocation_type VARCHAR(20) DEFAULT 'manual';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'allocated_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'ended_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'ended_reason' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN ended_reason VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'notes' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN notes TEXT;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'created_by' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN created_by UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'created_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_allocations' 
            AND column_name = 'updated_at' 
            AND table_schema = 'public'
        ) THEN
            ALTER TABLE room_allocations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. CREATE MISSING TABLES
-- =====================================================

-- Create room_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL,
    room_id UUID NOT NULL,
    request_type VARCHAR(50) DEFAULT 'allocation' CHECK (request_type IN ('allocation', 'transfer', 'change')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    priority_score INTEGER DEFAULT 0,
    preferred_room_type VARCHAR(50),
    preferred_floor INTEGER,
    special_requirements TEXT,
    notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_allocations table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL,
    room_id UUID NOT NULL,
    allocation_status VARCHAR(20) DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'confirmed', 'active', 'ended', 'cancelled')),
    allocation_type VARCHAR(20) DEFAULT 'manual' CHECK (allocation_type IN ('automatic', 'manual', 'transfer')),
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key constraints for room_requests
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_student_profile' 
        AND table_name = 'room_requests'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_student_profile 
        FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_room' 
        AND table_name = 'room_requests'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_room 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
    
    -- Only add processed_by foreign key if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'room_requests' 
        AND column_name = 'processed_by' 
        AND table_schema = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_processed_by' 
        AND table_name = 'room_requests'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_processed_by 
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints for room_allocations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_student_profile' 
        AND table_name = 'room_allocations'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_student_profile 
        FOREIGN KEY (student_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_room' 
        AND table_name = 'room_allocations'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_room 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_allocations_created_by' 
        AND table_name = 'room_allocations'
    ) THEN
        ALTER TABLE room_allocations ADD CONSTRAINT fk_room_allocations_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraints for users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_room' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_room 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
    
    -- Note: No hostel foreign key constraint needed for single hostel management
END $$;

-- =====================================================
-- 4. CREATE INDEXES
-- =====================================================

-- Indexes for room_requests
CREATE INDEX IF NOT EXISTS idx_room_requests_student_profile_id ON room_requests(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_room_id ON room_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_requests_requested_at ON room_requests(requested_at);

-- Indexes for room_allocations
CREATE INDEX IF NOT EXISTS idx_room_allocations_student_profile_id ON room_allocations(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_status ON room_allocations(allocation_status);
CREATE INDEX IF NOT EXISTS idx_room_allocations_allocated_at ON room_allocations(allocated_at);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_room_id ON users(room_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. CREATE RLS POLICIES
-- =====================================================

-- RLS policies for room_requests
DROP POLICY IF EXISTS "Users can view their own room requests" ON room_requests;
CREATE POLICY "Users can view their own room requests" ON room_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = room_requests.student_profile_id 
            AND user_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own room requests" ON room_requests;
CREATE POLICY "Users can insert their own room requests" ON room_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = room_requests.student_profile_id 
            AND user_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all room requests" ON room_requests;
CREATE POLICY "Admins can manage all room requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- RLS policies for room_allocations
DROP POLICY IF EXISTS "Users can view their own room allocations" ON room_allocations;
CREATE POLICY "Users can view their own room allocations" ON room_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = room_allocations.student_profile_id 
            AND user_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all room allocations" ON room_allocations;
CREATE POLICY "Admins can manage all room allocations" ON room_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- =====================================================
-- 7. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for room_requests
DROP TRIGGER IF EXISTS update_room_requests_updated_at ON room_requests;
CREATE TRIGGER update_room_requests_updated_at 
    BEFORE UPDATE ON room_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for room_allocations
DROP TRIGGER IF EXISTS update_room_allocations_updated_at ON room_allocations;
CREATE TRIGGER update_room_allocations_updated_at 
    BEFORE UPDATE ON room_allocations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE room_requests IS 'Room request management for students';
COMMENT ON TABLE room_allocations IS 'Room allocation tracking';

SELECT 'Schema fix completed successfully!' as status;
