-- Create database tables for student functionality
-- Date: 2025-01-15
-- Purpose: Set up tables for cleaning requests, leave requests, and complaints

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

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('emergency', 'medical', 'personal', 'family', 'academic')),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    destination VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    rejection_reason TEXT
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('maintenance', 'cleanliness', 'noise', 'security', 'food', 'other')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT,
    resolved_by UUID
);

-- Add foreign key constraints
ALTER TABLE cleaning_requests 
ADD CONSTRAINT fk_cleaning_requests_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE cleaning_requests 
ADD CONSTRAINT fk_cleaning_requests_student_id 
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE cleaning_requests 
ADD CONSTRAINT fk_cleaning_requests_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leave_requests 
ADD CONSTRAINT fk_leave_requests_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE leave_requests 
ADD CONSTRAINT fk_leave_requests_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_resolved_by 
FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_room_id ON cleaning_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_student_id ON cleaning_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_status ON cleaning_requests(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_created_at ON cleaning_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_from_date ON leave_requests(from_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON leave_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cleaning_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leave_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON complaints TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify the tables were created
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('cleaning_requests', 'leave_requests', 'complaints')
ORDER BY table_name, ordinal_position;
