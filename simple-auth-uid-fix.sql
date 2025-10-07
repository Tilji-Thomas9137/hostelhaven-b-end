-- Simple fix for auth_uid columns - No PL/pgSQL functions
-- This script creates missing tables and adds auth_uid columns safely

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create notifications table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_allocations table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    room_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_requests table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Try to add auth_uid column to existing tables (ignore errors if column already exists)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE users ADD COLUMN auth_uid UUID;
        RAISE NOTICE 'Added auth_uid column to users table';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'auth_uid column already exists in users table';
    END;
    
    BEGIN
        ALTER TABLE complaints ADD COLUMN auth_uid UUID;
        RAISE NOTICE 'Added auth_uid column to complaints table';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'auth_uid column already exists in complaints table';
    END;
    
    BEGIN
        ALTER TABLE payments ADD COLUMN auth_uid UUID;
        RAISE NOTICE 'Added auth_uid column to payments table';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'auth_uid column already exists in payments table';
    END;
    
    BEGIN
        ALTER TABLE leave_requests ADD COLUMN auth_uid UUID;
        RAISE NOTICE 'Added auth_uid column to leave_requests table';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'auth_uid column already exists in leave_requests table';
    END;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_auth_uid ON notifications(auth_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_room_allocations_auth_uid ON room_allocations(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_auth_uid ON room_requests(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_allocations_updated_at ON room_allocations;
CREATE TRIGGER update_room_allocations_updated_at 
    BEFORE UPDATE ON room_allocations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_requests_updated_at ON room_requests;
CREATE TRIGGER update_room_requests_updated_at 
    BEFORE UPDATE ON room_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (ignore errors if they don't exist)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can view their own room allocations" ON room_allocations;
    DROP POLICY IF EXISTS "Users can view their own room requests" ON room_requests;
    DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can insert their own room requests" ON room_requests;
    DROP POLICY IF EXISTS "Admins can manage all room allocations" ON room_allocations;
    DROP POLICY IF EXISTS "Admins can manage all room requests" ON room_requests;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if policies don't exist
        NULL;
END $$;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = auth_uid);

CREATE POLICY "Users can view their own room allocations" ON room_allocations
    FOR SELECT USING (auth.uid() = auth_uid);

CREATE POLICY "Users can view their own room requests" ON room_requests
    FOR SELECT USING (auth.uid() = auth_uid);

CREATE POLICY "Users can insert their own notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = auth_uid);

CREATE POLICY "Users can insert their own room requests" ON room_requests
    FOR INSERT WITH CHECK (auth.uid() = auth_uid);

-- Admin policies
CREATE POLICY "Admins can manage all room allocations" ON room_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

CREATE POLICY "Admins can manage all room requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Add comments
COMMENT ON TABLE notifications IS 'User notifications and messages';
COMMENT ON TABLE room_allocations IS 'Room allocation tracking';
COMMENT ON TABLE room_requests IS 'Room request management';

-- Show success message
SELECT 'auth_uid columns and tables created successfully' as status;
