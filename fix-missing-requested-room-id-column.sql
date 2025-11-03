-- FIX: Add missing requested_room_id column to room_requests table
-- Run this in Supabase SQL Editor

-- Step 1: Check current room_requests table structure
SELECT 
    'Current room_requests table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'room_requests' 
ORDER BY ordinal_position;

-- Step 2: Add the missing requested_room_id column
ALTER TABLE room_requests 
ADD COLUMN IF NOT EXISTS requested_room_id UUID REFERENCES rooms(id);

-- Step 3: Add other missing columns that might be needed
ALTER TABLE room_requests 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS preferred_room_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS preferred_floor INTEGER,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Step 4: Verify the column was added
SELECT 
    'Updated room_requests table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'room_requests' 
ORDER BY ordinal_position;

-- Step 5: Check if there are any existing room requests
SELECT 
    'Existing room requests:' as info,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
FROM room_requests;

-- Step 6: Test the fix by checking if we can now query with requested_room_id
SELECT 
    'Test query with requested_room_id:' as info,
    id,
    user_id,
    requested_room_id,
    preferred_room_type,
    status,
    created_at
FROM room_requests
LIMIT 5;

-- Step 7: Success message
SELECT 
    'SUCCESS!' as status,
    'requested_room_id column has been added to room_requests table' as message,
    'You can now create room requests without errors' as next_step;
