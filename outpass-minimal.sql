-- =====================================================
-- OUTPASS REQUESTS TABLE - MINIMAL SETUP
-- =====================================================
-- Clean SQL for outpass functionality connected to user_profiles, users, and rooms tables

-- Create outpass_requests table
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
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
    CONSTRAINT check_max_duration CHECK (end_date - start_date <= 7),
    CONSTRAINT check_parent_approval_required CHECK (parent_approval = true)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outpass_requests_user_id ON outpass_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_room_id ON outpass_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_status ON outpass_requests(status);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_created_at ON outpass_requests(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_outpass_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_outpass_requests_updated_at
    BEFORE UPDATE ON outpass_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_outpass_requests_updated_at();

-- Enable Row Level Security
ALTER TABLE outpass_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view own outpass requests" ON outpass_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students can create own outpass requests" ON outpass_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own pending outpass requests" ON outpass_requests
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Wardens can view all outpass requests" ON outpass_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'warden'
        )
    );

CREATE POLICY "Wardens can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'warden'
        )
    );

CREATE POLICY "Admins can view all outpass requests" ON outpass_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Helper function to get student's room_id from user_profiles table
CREATE OR REPLACE FUNCTION get_student_room_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
BEGIN
    -- First try to get from user_profiles table (primary source)
    SELECT room_id INTO v_room_id
    FROM user_profiles
    WHERE user_id = p_user_id
    AND room_id IS NOT NULL
    LIMIT 1;
    
    -- If not found in user_profiles, try room_allocations table
    IF v_room_id IS NULL THEN
        SELECT ra.room_id INTO v_room_id
        FROM room_allocations ra
        JOIN user_profiles up ON ra.student_profile_id = up.id
        WHERE up.user_id = p_user_id
        AND ra.allocation_status IN ('confirmed', 'active')
        AND ra.room_id IS NOT NULL
        ORDER BY ra.created_at DESC
        LIMIT 1;
    END IF;
    
    -- If still not found, try users table (fallback)
    IF v_room_id IS NULL THEN
        SELECT room_id INTO v_room_id
        FROM users
        WHERE id = p_user_id
        AND room_id IS NOT NULL
        LIMIT 1;
    END IF;
    
    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create outpass request with automatic room_id lookup
CREATE OR REPLACE FUNCTION create_outpass_request(
    p_user_id UUID,
    p_reason TEXT,
    p_destination VARCHAR(100),
    p_start_date DATE,
    p_end_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_transport_mode VARCHAR(50),
    p_emergency_contact VARCHAR(50),
    p_emergency_phone VARCHAR(10),
    p_parent_approval BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
    v_outpass_id UUID;
BEGIN
    -- Get the student's room_id
    v_room_id := get_student_room_id(p_user_id);
    
    -- Insert the outpass request
    INSERT INTO outpass_requests (
        user_id,
        room_id,
        reason,
        destination,
        start_date,
        end_date,
        start_time,
        end_time,
        transport_mode,
        emergency_contact,
        emergency_phone,
        parent_approval
    ) VALUES (
        p_user_id,
        v_room_id,
        p_reason,
        p_destination,
        p_start_date,
        p_end_date,
        p_start_time,
        p_end_time,
        p_transport_mode,
        p_emergency_contact,
        p_emergency_phone,
        p_parent_approval
    ) RETURNING id INTO v_outpass_id;
    
    RETURN v_outpass_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get outpass requests with user and room details
CREATE OR REPLACE FUNCTION get_outpass_requests_with_details(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    student_name VARCHAR(100),
    student_email VARCHAR(255),
    room_number VARCHAR(50),
    building_name VARCHAR(100),
    reason TEXT,
    destination VARCHAR(100),
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    transport_mode VARCHAR(50),
    emergency_contact VARCHAR(50),
    emergency_phone VARCHAR(10),
    parent_approval BOOLEAN,
    status VARCHAR(20),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        opr.id,
        opr.user_id,
        u.full_name,
        u.email,
        r.room_number,
        b.building_name,
        opr.reason,
        opr.destination,
        opr.start_date,
        opr.end_date,
        opr.start_time,
        opr.end_time,
        opr.transport_mode,
        opr.emergency_contact,
        opr.emergency_phone,
        opr.parent_approval,
        opr.status,
        opr.approved_by,
        opr.approved_at,
        opr.rejection_reason,
        opr.created_at,
        opr.updated_at
    FROM outpass_requests opr
    JOIN users u ON u.id = opr.user_id
    LEFT JOIN rooms r ON r.id = opr.room_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE (p_user_id IS NULL OR opr.user_id = p_user_id)
    ORDER BY opr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to update outpass status
CREATE OR REPLACE FUNCTION update_outpass_status(
    p_outpass_id UUID,
    p_status VARCHAR(20),
    p_approved_by UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate status
    IF p_status NOT IN ('approved', 'rejected', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved, rejected, completed, or cancelled.';
    END IF;
    
    -- Update the outpass request
    UPDATE outpass_requests 
    SET 
        status = p_status,
        approved_by = p_approved_by,
        approved_at = NOW(),
        rejection_reason = CASE 
            WHEN p_status = 'rejected' THEN p_rejection_reason 
            ELSE NULL 
        END,
        updated_at = NOW()
    WHERE id = p_outpass_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add table comments
COMMENT ON TABLE outpass_requests IS 'Stores outpass requests from students to leave the hostel';
COMMENT ON COLUMN outpass_requests.user_id IS 'Reference to the user (student) making the request';
COMMENT ON COLUMN outpass_requests.room_id IS 'Reference to the room the student is assigned to';
COMMENT ON COLUMN outpass_requests.status IS 'Current status: pending, approved, rejected, completed, cancelled';

-- Display setup summary
SELECT 
    'OUTPASS TABLE CREATED' as status,
    'outpass_requests table ready for use' as message;
