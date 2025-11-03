-- QUICK TEST: Check Request ID Issue
-- Run this in Supabase SQL Editor

-- Step 1: Check if the specific request exists
SELECT 
    'Specific Request Check:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM room_requests 
            WHERE id = '9cdb72f5-d388-467d-908e-50c392736cbf'
        ) THEN '✅ Request EXISTS'
        ELSE '❌ Request does NOT exist'
    END as status;

-- Step 2: Show all recent requests
SELECT 
    'Recent Room Requests:' as info,
    id,
    user_id,
    status,
    preferred_room_type,
    created_at
FROM room_requests
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Check if there are any requests with similar patterns
SELECT 
    'Similar Pattern Check:' as info,
    id,
    status,
    user_id,
    created_at
FROM room_requests
WHERE id LIKE '%9cdb%' 
   OR id LIKE '%d388%'
   OR id LIKE '%908e%'
   OR id LIKE '%50c3%'
ORDER BY created_at DESC;

-- Step 4: Check request ID format
SELECT 
    'ID Format Analysis:' as info,
    id,
    LENGTH(id) as length,
    CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN '✅ Valid UUID format'
        ELSE '❌ Invalid UUID format'
    END as format_check
FROM room_requests
ORDER BY created_at DESC
LIMIT 5;
