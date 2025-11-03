-- Migration script to migrate from leave_requests to outpass_requests
-- This script handles the transition from the old leave_requests table to the new outpass_requests table

-- Step 1: Check if leave_requests table exists and has data
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

-- Step 2: Create indexes on the migrated data for better performance
CREATE INDEX IF NOT EXISTS idx_outpass_requests_user_status ON outpass_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outpass_requests_date_range ON outpass_requests(start_date, end_date);

-- Step 3: Update any existing foreign key references (if any)
-- This would depend on your specific schema, but here's a general example:

-- If there are any tables that reference leave_requests.id, you might need to update them
-- For example, if there's a table called 'leave_request_attachments':
-- ALTER TABLE leave_request_attachments 
-- DROP CONSTRAINT IF EXISTS fk_leave_request_attachments_leave_request_id,
-- ADD CONSTRAINT fk_leave_request_attachments_outpass_request_id 
-- FOREIGN KEY (leave_request_id) REFERENCES outpass_requests(id) ON DELETE CASCADE;

-- Step 4: Create a function to handle the transition in application code
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
    updated_at TIMESTAMP WITH TIME ZONE
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
        or.updated_at
    FROM outpass_requests or
    WHERE or.user_id = p_user_id
    ORDER BY or.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a function to create new outpass requests
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

-- Step 6: Display summary
SELECT 
    'Migration Summary' as summary,
    (SELECT COUNT(*) FROM outpass_requests) as total_outpass_requests,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'pending') as pending_requests,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'approved') as approved_requests,
    (SELECT COUNT(*) FROM outpass_requests WHERE status = 'rejected') as rejected_requests;

-- Display table structure
\d outpass_requests;
