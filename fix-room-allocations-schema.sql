-- Fix room_allocations table schema to match backend expectations
-- Run this in Supabase SQL Editor

-- Drop the existing table and recreate with correct column names
DROP TABLE IF EXISTS room_allocations CASCADE;

-- Recreate the table with the correct column names that match the backend code
CREATE TABLE room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_profile_id UUID,
    room_id UUID NOT NULL,
    request_id UUID,
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_at TIMESTAMP WITH TIME ZONE, -- This is what the backend expects
    start_date DATE NOT NULL,
    end_date DATE,
    allocation_status VARCHAR(20) DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'confirmed', 'active', 'inactive', 'terminated')), -- This is what the backend expects
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')), -- Keep this for compatibility
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Verify the table was created correctly
SELECT 
    'room_allocations table created with correct schema' as status,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations';

-- Show the column structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'room_allocations'
ORDER BY ordinal_position;
