-- Add the missing room_allocations table to fix the database schema error
-- Run this in Supabase SQL Editor

-- Create room_allocations table
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_profile_id UUID,
    room_id UUID NOT NULL,
    request_id UUID,
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Add foreign key constraints only if the referenced tables exist
DO $$ 
BEGIN
    -- Check if users table exists and has id column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        ALTER TABLE room_allocations 
        ADD CONSTRAINT fk_room_allocations_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to users table';
    ELSE
        RAISE NOTICE 'Users table does not exist or missing id column, skipping foreign key constraint';
    END IF;
    
    -- Check if rooms table exists and has id column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'rooms'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'id'
    ) THEN
        ALTER TABLE room_allocations 
        ADD CONSTRAINT fk_room_allocations_room_id 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to rooms table';
    ELSE
        RAISE NOTICE 'Rooms table does not exist or missing id column, skipping foreign key constraint';
    END IF;
    
    -- Check if room_requests table exists and has id column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'room_requests'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'room_requests' AND column_name = 'id'
    ) THEN
        ALTER TABLE room_allocations 
        ADD CONSTRAINT fk_room_allocations_request_id 
        FOREIGN KEY (request_id) REFERENCES room_requests(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key constraint to room_requests table';
    ELSE
        RAISE NOTICE 'Room_requests table does not exist or missing id column, skipping foreign key constraint';
    END IF;
END $$;

-- Verify the table was created
SELECT 'room_allocations table created successfully' as status;
