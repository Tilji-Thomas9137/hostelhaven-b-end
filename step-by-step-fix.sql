-- Step-by-step fix for auth_uid columns
-- Run this step by step to avoid errors

-- Step 1: Check what we're working with
SELECT 'Starting database fix...' as status;

-- Step 2: Add auth_uid to users table (this should exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID;
SELECT 'Added auth_uid to users table' as status;

-- Step 3: Try to add auth_uid to complaints table (may not exist)
DO $$
BEGIN
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS auth_uid UUID;
    RAISE NOTICE 'Added auth_uid to complaints table';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'complaints table does not exist, skipping';
    WHEN duplicate_column THEN
        RAISE NOTICE 'auth_uid column already exists in complaints table';
END $$;

-- Step 4: Try to add auth_uid to payments table (may not exist)
DO $$
BEGIN
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS auth_uid UUID;
    RAISE NOTICE 'Added auth_uid to payments table';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'payments table does not exist, skipping';
    WHEN duplicate_column THEN
        RAISE NOTICE 'auth_uid column already exists in payments table';
END $$;

-- Step 5: Try to add auth_uid to leave_requests table (may not exist)
DO $$
BEGIN
    ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS auth_uid UUID;
    RAISE NOTICE 'Added auth_uid to leave_requests table';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'leave_requests table does not exist, skipping';
    WHEN duplicate_column THEN
        RAISE NOTICE 'auth_uid column already exists in leave_requests table';
END $$;

-- Step 6: Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT 'Created notifications table' as status;

-- Step 7: Create room_allocations table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    room_id UUID,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT 'Created room_allocations table' as status;

-- Step 8: Create room_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT 'Created room_requests table' as status;

-- Step 9: Show final status
SELECT 'Database fix completed successfully!' as status;
