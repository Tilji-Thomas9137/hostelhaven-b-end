-- Clean fix for auth_uid columns - Simple and reliable
-- This script creates missing tables and adds auth_uid columns

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create notifications table
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

-- Create room_allocations table
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

-- Create room_requests table
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

-- Add auth_uid column to existing tables (ignore errors if column already exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS auth_uid UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_auth_uid ON notifications(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_allocations_auth_uid ON room_allocations(auth_uid);
CREATE INDEX IF NOT EXISTS idx_room_requests_auth_uid ON room_requests(auth_uid);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own room allocations" ON room_allocations;
DROP POLICY IF EXISTS "Users can view their own room requests" ON room_requests;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = auth_uid);

CREATE POLICY "Users can view their own room allocations" ON room_allocations
    FOR SELECT USING (auth.uid() = auth_uid);

CREATE POLICY "Users can view their own room requests" ON room_requests
    FOR SELECT USING (auth.uid() = auth_uid);

-- Show success message
SELECT 'auth_uid columns and tables created successfully' as status;
