-- Diagnostic script to check database state
-- Run this first to see what exists

-- Check what tables exist
SELECT 'TABLES THAT EXIST:' as info;
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check what columns exist in each table
SELECT 'COLUMNS IN EACH TABLE:' as info;

-- Check users table columns
SELECT 'USERS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- Check complaints table columns (if it exists)
SELECT 'COMPLAINTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'complaints'
ORDER BY ordinal_position;

-- Check notifications table columns (if it exists)
SELECT 'NOTIFICATIONS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Check room_allocations table columns (if it exists)
SELECT 'ROOM_ALLOCATIONS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations'
ORDER BY ordinal_position;

-- Check room_requests table columns (if it exists)
SELECT 'ROOM_REQUESTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_requests'
ORDER BY ordinal_position;
