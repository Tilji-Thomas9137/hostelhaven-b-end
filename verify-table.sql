-- Simple verification script for room_allocations table
-- Run this in Supabase SQL Editor

-- Check if table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'room_allocations'
        ) THEN 'EXISTS'
        ELSE 'DOES NOT EXIST'
    END as table_status;

-- Show all columns in the table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations'
ORDER BY ordinal_position;

-- Test inserting a sample record (this will help refresh the schema cache)
INSERT INTO room_allocations (
    user_id, 
    room_id, 
    start_date, 
    status
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    CURRENT_DATE,
    'active'
) ON CONFLICT DO NOTHING;

-- Verify the insert worked
SELECT COUNT(*) as total_records FROM room_allocations;

-- Clean up the test record
DELETE FROM room_allocations WHERE status = 'active' AND created_at > NOW() - INTERVAL '1 minute';
