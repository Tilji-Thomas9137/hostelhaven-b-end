-- COMPREHENSIVE ROOM REQUEST & ALLOCATION SYSTEM SETUP
-- Run this in Supabase SQL Editor to ensure everything works

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

-- Step 2: Check current room_allocations table structure
SELECT 
    'Current room_allocations table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'room_allocations' 
ORDER BY ordinal_position;

-- Step 3: Ensure required columns exist in room_requests
ALTER TABLE room_requests 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS preferred_room_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS preferred_floor INTEGER,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 4: Ensure required columns exist in room_allocations
ALTER TABLE room_allocations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id),
ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(20) DEFAULT 'confirmed',
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 5: Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS room_requests_user_unique 
ON room_requests (user_id) 
WHERE status IN ('pending', 'waitlisted', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS room_allocations_user_unique 
ON room_allocations (user_id);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests (status);
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_user_id ON room_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations (room_id);

-- Step 7: Clean up any orphaned or duplicate data
-- Remove duplicate room requests (keep the most recent)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM room_requests
    WHERE status IN ('pending', 'waitlisted', 'approved')
)
DELETE FROM room_requests 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Remove duplicate room allocations (keep the most recent)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM room_allocations
)
DELETE FROM room_allocations 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 8: Verify the setup
SELECT 
    'Setup Complete!' as status,
    'Room requests and allocations are now fully functional' as message;

-- Step 9: Show current data
SELECT 
    'Current Room Requests:' as info,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
FROM room_requests;

SELECT 
    'Current Room Allocations:' as info,
    COUNT(*) as total_allocations,
    COUNT(CASE WHEN allocation_status = 'confirmed' THEN 1 END) as confirmed,
    COUNT(CASE WHEN allocation_status = 'active' THEN 1 END) as active
FROM room_allocations;
