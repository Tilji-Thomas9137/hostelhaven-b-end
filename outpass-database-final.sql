-- =====================================================
-- OUTPASS REQUESTS DATABASE - COMPLETE SETUP
-- =====================================================
-- This file contains everything needed to set up the outpass requests system
-- Run this single file to create tables, migrate data, and set up all functions

-- =====================================================
-- STEP 1: CREATE OUTPASS_REQUESTS TABLE
-- =====================================================

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

-- =====================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outpass_requests_user_id ON outpass_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_room_id ON outpass_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_status ON outpass_requests(status);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_created_at ON outpass_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_start_date ON outpass_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_approved_by ON outpass_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_user_status ON outpass_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_date_range ON outpass_requests(start_date, end_date);

-- =====================================================
-- STEP 3: CREATE TRIGGER FOR UPDATED_AT
-- =====================================================

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

-- =====================================================
-- STEP 4: ADD TABLE COMMENTS
-- =====================================================

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

-- =====================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- =====================================================

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
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'warden'
        )
    );

-- Wardens can update outpass requests (approve/reject)
CREATE POLICY "Wardens can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'warden'
        )
    );

-- Admins can view all outpass requests
CREATE POLICY "Admins can view all outpass requests" ON outpass_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Admins can update outpass requests
CREATE POLICY "Admins can update outpass requests" ON outpass_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Admins can delete outpass requests
CREATE POLICY "Admins can delete outpass requests" ON outpass_requests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- =====================================================
-- STEP 6: MIGRATE DATA FROM LEAVE_REQUESTS (IF EXISTS)
-- =====================================================

-- Migration script to migrate from leave_requests to outpass_requests
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leave_requests') THEN
        RAISE NOTICE 'leave_requests table exists. Proceeding with migration...';
        
        -- Check if there are any records in leave_requests
        IF EXISTS (SELECT 1 FROM leave_requests LIMIT 1) THEN
            RAISE NOTICE 'Found existing leave_requests data. Migrating to outpass_requests...';
            
            -- Insert data from leave_requests to outpass_requests
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
                parent_approval,
                status,
                approved_by,
                approved_at,
                rejection_reason,
                created_at,
                updated_at
            )
            SELECT 
                lr.user_id,
                -- Try to get room_id from user_profiles or room_allocations
                COALESCE(
                    ra.room_id,
                    up.room_id
                ) as room_id,
                lr.reason,
                COALESCE(lr.destination, 'Not specified') as destination,
                lr.start_date,
                lr.end_date,
                -- Set default times if not present
                COALESCE(lr.start_time, '09:00:00') as start_time,
                COALESCE(lr.end_time, '17:00:00') as end_time,
                -- Set default transport mode
                COALESCE(lr.transport_mode, 'other') as transport_mode,
                COALESCE(lr.emergency_contact, 'Not specified') as emergency_contact,
                lr.emergency_phone,
                -- Set parent approval based on existing data or default to true for existing requests
                COALESCE(lr.parent_approval, true) as parent_approval,
                lr.status,
                lr.approved_by,
                lr.approved_at,
                lr.rejection_reason,
                lr.created_at,
                lr.updated_at
            FROM leave_requests lr
            LEFT JOIN room_allocations ra ON ra.user_id = lr.user_id AND ra.status = 'active'
            LEFT JOIN user_profiles up ON up.user_id = lr.user_id
            WHERE NOT EXISTS (
                -- Avoid duplicates
                SELECT 1 FROM outpass_requests or2 
                WHERE or2.user_id = lr.user_id 
                AND or2.reason = lr.reason 
                AND or2.start_date = lr.start_date
            );
            
            RAISE NOTICE 'Migration completed successfully. Migrated % records from leave_requests to outpass_requests.', 
                (SELECT COUNT(*) FROM leave_requests);
        ELSE
            RAISE NOTICE 'No data found in leave_requests table.';
        END IF;
        
        -- Create a view for backward compatibility (optional)
        CREATE OR REPLACE VIEW leave_requests AS
        SELECT 
            id,
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
            parent_approval,
            status,
            approved_by,
            approved_at,
            rejection_reason,
            created_at,
            updated_at,
            -- Add computed columns for backward compatibility
            NULL as actual_return_date,
            NULL as actual_return_time,
            false as is_returned
        FROM outpass_requests;
        
        RAISE NOTICE 'Created backward compatibility view: leave_requests';
        
    ELSE
        RAISE NOTICE 'leave_requests table does not exist. No migration needed.';
    END IF;
END $$;

-- =====================================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get student's outpass requests
CREATE OR REPLACE FUNCTION get_student_outpass_requests(p_user_id UUID)
RETURNS TABLE (
    id UUID,
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
    updated_at TIMESTAMP WITH TIME ZONE,
    room_number VARCHAR(50),
    room_type VARCHAR(50),
    building_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        or.id,
        or.reason,
        or.destination,
        or.start_date,
        or.end_date,
        or.start_time,
        or.end_time,
        or.transport_mode,
        or.emergency_contact,
        or.emergency_phone,
        or.parent_approval,
        or.status,
        or.approved_by,
        or.approved_at,
        or.rejection_reason,
        or.created_at,
        or.updated_at,
        r.room_number,
        r.room_type,
        b.building_name
    FROM outpass_requests or
    LEFT JOIN rooms r ON r.id = or.room_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE or.user_id = p_user_id
    ORDER BY or.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to create new outpass requests
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
    -- Get the student's current room allocation
    SELECT ra.room_id INTO v_room_id
    FROM room_allocations ra
    WHERE ra.user_id = p_user_id 
    AND ra.status = 'active'
    LIMIT 1;
    
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

-- Function to approve/reject outpass request
CREATE OR REPLACE FUNCTION update_outpass_status(
    p_outpass_id UUID,
    p_status VARCHAR(20),
    p_approved_by UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate status
    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved or rejected.';
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
    
    -- Check if update was successful
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark student as returned
CREATE OR REPLACE FUNCTION mark_student_returned(
    p_outpass_id UUID,
    p_actual_return_date DATE DEFAULT NULL,
    p_actual_return_time TIME DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the outpass request
    UPDATE outpass_requests 
    SET 
        status = 'completed',
        actual_return_date = COALESCE(p_actual_return_date, CURRENT_DATE),
        actual_return_time = COALESCE(p_actual_return_time, CURRENT_TIME),
        is_returned = true,
        updated_at = NOW()
    WHERE id = p_outpass_id
    AND status = 'approved';
    
    -- Check if update was successful
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get all pending outpass requests for wardens
CREATE OR REPLACE FUNCTION get_pending_outpass_requests()
RETURNS TABLE (
    id UUID,
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
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        or.id,
        u.full_name,
        u.email,
        r.room_number,
        b.building_name,
        or.reason,
        or.destination,
        or.start_date,
        or.end_date,
        or.start_time,
        or.end_time,
        or.transport_mode,
        or.emergency_contact,
        or.emergency_phone,
        or.parent_approval,
        or.created_at
    FROM outpass_requests or
    JOIN users u ON u.id = or.user_id
    LEFT JOIN rooms r ON r.id = or.room_id
    LEFT JOIN buildings b ON b.id = r.building_id
    WHERE or.status = 'pending'
    ORDER BY or.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 8: DISPLAY SETUP SUMMARY
-- =====================================================

-- Display setup summary
SELECT 
    'OUTPASS DATABASE SETUP COMPLETE' as status,
    'outpass_requests table created successfully' as message,
    (SELECT COUNT(*) FROM outpass_requests) as total_records,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'pending') as pending_requests,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'approved') as approved_requests,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'rejected') as rejected_requests;

-- Display table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'outpass_requests' 
ORDER BY ordinal_position;

-- Display available functions
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
    'get_student_outpass_requests',
    'create_outpass_request',
    'update_outpass_status',
    'mark_student_returned',
    'get_pending_outpass_requests'
)
ORDER BY routine_name;
