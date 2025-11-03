-- DEBUG: Check Room Requests
-- Run this in Supabase SQL Editor to see what requests exist

-- Step 1: Check all room requests
SELECT 
    'All Room Requests:' as info,
    id,
    user_id,
    status,
    preferred_room_type,
    created_at
FROM room_requests
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check if the specific request ID exists
SELECT 
    'Specific Request Check:' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM room_requests 
            WHERE id = '9cdb72f5-d388-467d-908e-50c392736cbf'
        ) THEN '✅ Request exists'
        ELSE '❌ Request does not exist'
    END as status;

-- Step 3: Check request ID format
SELECT 
    'Request ID Format Check:' as info,
    id,
    LENGTH(id) as id_length,
    id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' as is_uuid_format
FROM room_requests
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check for any requests with similar IDs
SELECT 
    'Similar ID Check:' as info,
    id,
    status,
    user_id
FROM room_requests
WHERE id LIKE '%9cdb72f5%' 
   OR id LIKE '%d388%'
   OR id LIKE '%908e%'
   OR id LIKE '%50c392736cbf%';
