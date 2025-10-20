-- Create cleaning_requests table and sample data
-- Run this in Supabase SQL Editor

-- Create cleaning_requests table
CREATE TABLE IF NOT EXISTS cleaning_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    student_id UUID NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time VARCHAR(20) NOT NULL CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
    cleaning_type VARCHAR(20) NOT NULL CHECK (cleaning_type IN ('general', 'deep', 'window', 'bathroom')),
    special_instructions TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Add foreign key constraints
DO $$ 
BEGIN
    -- Check if rooms table exists and has id column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'rooms'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'id'
    ) THEN
        ALTER TABLE cleaning_requests 
        ADD CONSTRAINT fk_cleaning_requests_room_id 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to rooms table';
    ELSE
        RAISE NOTICE 'Rooms table does not exist or missing id column, skipping foreign key constraint';
    END IF;
    
    -- Check if users table exists and has id column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        ALTER TABLE cleaning_requests 
        ADD CONSTRAINT fk_cleaning_requests_student_id 
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to users table';
    ELSE
        RAISE NOTICE 'Users table does not exist or missing id column, skipping foreign key constraint';
    END IF;
END $$;

-- Insert sample cleaning requests
INSERT INTO cleaning_requests (
    room_id,
    student_id,
    preferred_date,
    preferred_time,
    cleaning_type,
    special_instructions,
    status
) 
SELECT 
    r.id,
    u.id,
    CURRENT_DATE + INTERVAL '1 day',
    'morning',
    'general',
    'Please clean the room thoroughly, especially the bathroom area',
    'pending'
FROM rooms r, users u 
WHERE r.room_number = 'A1102' 
AND u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert another sample request
INSERT INTO cleaning_requests (
    room_id,
    student_id,
    preferred_date,
    preferred_time,
    cleaning_type,
    special_instructions,
    status
) 
SELECT 
    r.id,
    u.id,
    CURRENT_DATE + INTERVAL '2 days',
    'afternoon',
    'deep',
    'Deep cleaning needed for move-out preparation',
    'pending'
FROM rooms r, users u 
WHERE r.room_number = 'D201' 
AND u.email = 'aswinmurali2026@mca.ajce.in'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify the table was created and data was inserted
SELECT 'cleaning_requests table created successfully' as status;

-- Show the created cleaning requests
SELECT 
    cr.id,
    cr.preferred_date,
    cr.preferred_time,
    cr.cleaning_type,
    cr.status,
    r.room_number,
    u.full_name as student_name
FROM cleaning_requests cr
LEFT JOIN rooms r ON cr.room_id = r.id
LEFT JOIN users u ON cr.student_id = u.id
ORDER BY cr.created_at DESC;
