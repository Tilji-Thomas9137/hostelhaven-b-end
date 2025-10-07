-- Create missing tables for HostelHaven
-- This script creates the essential tables that are causing 404/400 errors

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add auth_uid column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID;

-- Add auth_uid column to other tables if they exist
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS auth_uid UUID;

-- Skip hostels table for single-hostel system
-- Hostel information can be stored in environment variables or config

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL, -- Links to Supabase auth.users.id
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room allocations table (if not exists)
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL, -- Links to Supabase auth.users.id
    room_id UUID, -- Will reference rooms table when it exists
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID, -- Links to Supabase auth.users.id
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room requests table (if not exists)
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL, -- Links to Supabase auth.users.id
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID, -- Links to Supabase auth.users.id
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_auth_uid ON notifications(auth_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_room_allocations_auth_uid ON room_allocations(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_auth_uid ON room_requests(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);

-- Skip hostel insertion for single-hostel system

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
DROP TRIGGER IF EXISTS update_hostels_updated_at ON hostels;
CREATE TRIGGER update_hostels_updated_at 
    BEFORE UPDATE ON hostels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Skip hostel policies for single-hostel system

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

COMMENT ON TABLE notifications IS 'User notifications and messages';
COMMENT ON TABLE room_allocations IS 'Room allocation tracking';
COMMENT ON TABLE room_requests IS 'Room request management';
