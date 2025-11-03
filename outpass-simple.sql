-- Simple Outpass Requests Table
-- Connected to user_profiles and rooms tables

CREATE TABLE IF NOT EXISTS outpass_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Connection to user_profiles table
    user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Connection to rooms table
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    
    -- Outpass form fields
    reason TEXT NOT NULL,
    destination VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    transport_mode VARCHAR(50) NOT NULL,
    emergency_contact VARCHAR(50) NOT NULL,
    emergency_phone VARCHAR(10),
    parent_approval BOOLEAN NOT NULL DEFAULT false,
    
    -- Status and approval
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outpass_user_profile_id ON outpass_requests(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_outpass_room_id ON outpass_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_outpass_status ON outpass_requests(status);
