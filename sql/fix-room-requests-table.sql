-- Fix room_requests table structure
-- Date: 2025-01-15
-- Purpose: Add missing columns and fix foreign key relationships

-- First, let's check the current structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'room_requests' 
ORDER BY ordinal_position;

-- Add missing columns to room_requests table
ALTER TABLE room_requests 
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS allocated_room_id UUID,
ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processed_by UUID,
ADD COLUMN IF NOT EXISTS preferred_room_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS preferred_floor INTEGER,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'medium';

-- Add check constraints for new columns (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_requests_preferred_room_type_check'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT room_requests_preferred_room_type_check 
            CHECK (preferred_room_type IN ('single', 'double', 'triple', 'suite'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'room_requests_urgency_level_check'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT room_requests_urgency_level_check 
            CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent'));
    END IF;
END $$;

-- Add foreign key constraints
DO $$ 
BEGIN
    -- Add foreign key for user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_user_id'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    -- Add foreign key for allocated_room_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_allocated_room_id'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_allocated_room_id 
            FOREIGN KEY (allocated_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    -- Add foreign key for processed_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_room_requests_processed_by'
    ) THEN
        ALTER TABLE room_requests ADD CONSTRAINT fk_room_requests_processed_by 
            FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update existing records to populate user_id from student_profile_id
UPDATE room_requests 
SET user_id = (
    SELECT u.id 
    FROM users u 
    JOIN user_profiles up ON u.id = up.user_id 
    WHERE up.id = room_requests.student_profile_id
)
WHERE user_id IS NULL AND student_profile_id IS NOT NULL;

-- Update existing records to populate allocated_room_id from room_id
UPDATE room_requests 
SET allocated_room_id = room_id
WHERE allocated_room_id IS NULL AND room_id IS NOT NULL;

-- Set requested_at for existing records
UPDATE room_requests 
SET requested_at = created_at
WHERE requested_at IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_allocated_room_id ON room_requests(allocated_room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_processed_by ON room_requests(processed_by);
CREATE INDEX IF NOT EXISTS idx_room_requests_requested_at ON room_requests(requested_at);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'room_requests' 
ORDER BY ordinal_position;
