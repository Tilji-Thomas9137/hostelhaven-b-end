-- Create outpass_requests table
-- This table stores outpass requests from students to leave the hostel

CREATE TABLE IF NOT EXISTS outpass_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User relationship (who is making the request)
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Room relationship (which room the student is assigned to)
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    
    -- Request details
    reason TEXT NOT NULL CHECK (length(reason) >= 10 AND length(reason) <= 500),
    destination VARCHAR(100) NOT NULL CHECK (length(destination) >= 3 AND length(destination) <= 100),
    
    -- Date and time information
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Transport information
    transport_mode VARCHAR(50) NOT NULL CHECK (transport_mode IN ('bus', 'train', 'car', 'taxi', 'auto', 'walking', 'other')),
    
    -- Emergency contact information
    emergency_contact VARCHAR(50) NOT NULL CHECK (length(emergency_contact) >= 3 AND length(emergency_contact) <= 50),
    emergency_phone VARCHAR(10) CHECK (emergency_phone IS NULL OR (length(emergency_phone) = 10 AND emergency_phone ~ '^[0-9]+$')),
    
    -- Parent/Guardian approval
    parent_approval BOOLEAN NOT NULL DEFAULT false,
    
    -- Request status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    
    -- Approval information
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Warden or Admin who approved/rejected
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Completion information
    actual_return_date DATE,
    actual_return_time TIME,
    is_returned BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_end_after_start CHECK (end_date >= start_date),
    CONSTRAINT check_start_not_past CHECK (start_date >= CURRENT_DATE),
    CONSTRAINT check_max_duration CHECK (end_date - start_date <= INTERVAL '7 days'),
    CONSTRAINT check_parent_approval_required CHECK (parent_approval = true)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outpass_requests_user_id ON outpass_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_room_id ON outpass_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_status ON outpass_requests(status);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_created_at ON outpass_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_start_date ON outpass_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_approved_by ON outpass_requests(approved_by);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_outpass_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_outpass_requests_updated_at
    BEFORE UPDATE ON outpass_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_outpass_requests_updated_at();

-- Add comments to the table and columns
COMMENT ON TABLE outpass_requests IS 'Stores outpass requests from students to leave the hostel';
COMMENT ON COLUMN outpass_requests.user_id IS 'Reference to the user (student) making the request';
COMMENT ON COLUMN outpass_requests.room_id IS 'Reference to the room the student is assigned to';
COMMENT ON COLUMN outpass_requests.reason IS 'Detailed reason for the outpass request (10-500 characters)';
COMMENT ON COLUMN outpass_requests.destination IS 'Where the student is going (3-100 characters)';
COMMENT ON COLUMN outpass_requests.start_date IS 'Date when the student plans to leave';
COMMENT ON COLUMN outpass_requests.end_date IS 'Date when the student plans to return';
COMMENT ON COLUMN outpass_requests.start_time IS 'Time when the student plans to leave';
COMMENT ON COLUMN outpass_requests.end_time IS 'Time when the student plans to return';
COMMENT ON COLUMN outpass_requests.transport_mode IS 'Mode of transportation (bus, train, car, taxi, auto, walking, other)';
COMMENT ON COLUMN outpass_requests.emergency_contact IS 'Emergency contact person name';
COMMENT ON COLUMN outpass_requests.emergency_phone IS 'Emergency contact phone number (10 digits)';
COMMENT ON COLUMN outpass_requests.parent_approval IS 'Whether parent/guardian approval has been obtained';
COMMENT ON COLUMN outpass_requests.status IS 'Current status of the request (pending, approved, rejected, completed, cancelled)';
COMMENT ON COLUMN outpass_requests.approved_by IS 'User ID of the warden/admin who approved/rejected the request';
COMMENT ON COLUMN outpass_requests.approved_at IS 'Timestamp when the request was approved/rejected';
COMMENT ON COLUMN outpass_requests.rejection_reason IS 'Reason for rejection if status is rejected';
COMMENT ON COLUMN outpass_requests.actual_return_date IS 'Actual date when the student returned';
COMMENT ON COLUMN outpass_requests.actual_return_time IS 'Actual time when the student returned';
COMMENT ON COLUMN outpass_requests.is_returned IS 'Whether the student has actually returned';

-- Enable Row Level Security (RLS)
ALTER TABLE outpass_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Students can view their own outpass requests
CREATE POLICY "Students can view own outpass requests" ON outpass_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Students can insert their own outpass requests
CREATE POLICY "Students can create own outpass requests" ON outpass_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Students can update their own pending outpass requests
CREATE POLICY "Students can update own pending outpass requests" ON outpass_requests
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Students can delete their own pending outpass requests
CREATE POLICY "Students can delete own pending outpass requests" ON outpass_requests
    FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

-- Wardens can view all outpass requests
CREATE POLICY "Wardens can view all outpass requests" ON outpass_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'warden'
        )
    );

-- Wardens can update outpass requests (approve/reject)
CREATE POLICY "Wardens can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'warden'
        )
    );

-- Admins can view all outpass requests
CREATE POLICY "Admins can view all outpass requests" ON outpass_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Admins can update outpass requests
CREATE POLICY "Admins can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Admins can delete outpass requests
CREATE POLICY "Admins can delete outpass requests" ON outpass_requests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Insert sample data (optional - for testing)
-- INSERT INTO outpass_requests (
--     user_id, room_id, reason, destination, start_date, end_date, 
--     start_time, end_time, transport_mode, emergency_contact, 
--     emergency_phone, parent_approval
-- ) VALUES (
--     (SELECT id FROM users WHERE role = 'student' LIMIT 1),
--     (SELECT id FROM rooms LIMIT 1),
--     'Medical appointment at city hospital for regular checkup',
--     'City Hospital, Medical District',
--     CURRENT_DATE + INTERVAL '1 day',
--     CURRENT_DATE + INTERVAL '1 day',
--     '09:00:00',
--     '17:00:00',
--     'taxi',
--     'John Doe',
--     '9876543210',
--     true
-- );

-- Display table structure
\d outpass_requests;
