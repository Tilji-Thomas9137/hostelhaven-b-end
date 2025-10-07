-- Check what tables exist in the database
-- This will help us understand the current state

-- List all tables
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if auth_uid column exists in key tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'complaints', 'payments', 'leave_requests', 'notifications', 'room_allocations', 'room_requests')
AND column_name = 'auth_uid'
ORDER BY table_name;

-- Check what columns exist in users table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;
