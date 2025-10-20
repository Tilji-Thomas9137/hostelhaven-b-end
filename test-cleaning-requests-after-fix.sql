-- Test cleaning requests functionality after removing assigned_to column
-- Run this in Supabase SQL Editor

-- Step 1: Verify the assigned_to column has been removed
SELECT 'Step 1: Verifying assigned_to column removal...' as step;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'cleaning_requests' 
AND column_name = 'assigned_to';

-- Step 2: Show current cleaning_requests table structure
SELECT 'Step 2: Current cleaning_requests table structure:' as step;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'cleaning_requests'
ORDER BY ordinal_position;

-- Step 3: Test updating a cleaning request status (should work without assigned_to)
SELECT 'Step 3: Testing cleaning request status updates...' as step;

-- First, check if we have any pending requests
SELECT 
    id,
    status,
    cleaning_type,
    preferred_date,
    preferred_time
FROM cleaning_requests 
WHERE status = 'pending'
LIMIT 1;

-- Step 4: Test approving a request (without assigned_to)
DO $$
DECLARE
    request_id UUID;
BEGIN
    -- Get a pending request ID
    SELECT id INTO request_id 
    FROM cleaning_requests 
    WHERE status = 'pending' 
    LIMIT 1;
    
    IF request_id IS NOT NULL THEN
        -- Update the request to approved (without assigned_to)
        UPDATE cleaning_requests 
        SET 
            status = 'approved',
            notes = 'Test approval without assigned_to',
            updated_at = NOW()
        WHERE id = request_id;
        
        RAISE NOTICE 'Successfully approved cleaning request % without assigned_to', request_id;
    ELSE
        RAISE NOTICE 'No pending cleaning requests found to test';
    END IF;
END $$;

-- Step 5: Verify the update worked
SELECT 'Step 5: Verifying the approval worked...' as step;
SELECT 
    id,
    status,
    notes,
    updated_at
FROM cleaning_requests 
WHERE status = 'approved'
AND notes = 'Test approval without assigned_to'
LIMIT 1;

-- Step 6: Test other status transitions
SELECT 'Step 6: Testing other status transitions...' as step;

DO $$
DECLARE
    request_id UUID;
BEGIN
    -- Get an approved request ID
    SELECT id INTO request_id 
    FROM cleaning_requests 
    WHERE status = 'approved' 
    LIMIT 1;
    
    IF request_id IS NOT NULL THEN
        -- Update to in_progress
        UPDATE cleaning_requests 
        SET 
            status = 'in_progress',
            updated_at = NOW()
        WHERE id = request_id;
        
        RAISE NOTICE 'Successfully updated cleaning request % to in_progress', request_id;
        
        -- Update to completed
        UPDATE cleaning_requests 
        SET 
            status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = request_id;
        
        RAISE NOTICE 'Successfully completed cleaning request %', request_id;
    ELSE
        RAISE NOTICE 'No approved cleaning requests found to test';
    END IF;
END $$;

-- Step 7: Final verification
SELECT 'Step 7: Final verification - all cleaning requests status:' as step;
SELECT 
    status,
    COUNT(*) as count
FROM cleaning_requests 
GROUP BY status
ORDER BY status;

-- Step 8: Show sample requests with all relevant data
SELECT 'Step 8: Sample cleaning requests with complete data:' as step;
SELECT 
    cr.id,
    cr.cleaning_type,
    cr.status,
    cr.preferred_date,
    cr.preferred_time,
    cr.special_instructions,
    cr.notes,
    cr.created_at,
    cr.updated_at,
    cr.completed_at,
    u.full_name as student_name,
    u.username as admission_number,
    r.room_number,
    r.floor
FROM cleaning_requests cr
LEFT JOIN users u ON cr.student_id = u.id
LEFT JOIN rooms r ON cr.room_id = r.id
ORDER BY cr.created_at DESC
LIMIT 5;

SELECT 'Cleaning requests functionality test completed successfully!' as status;
