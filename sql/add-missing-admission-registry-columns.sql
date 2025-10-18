-- Add Missing Columns to admission_registry Table
-- Date: 2025-01-15
-- Purpose: Add missing status, parent_relation, student_email, and student_phone columns

-- Add missing columns to admission_registry table
ALTER TABLE admission_registry 
ADD COLUMN IF NOT EXISTS parent_relation VARCHAR(50),
ADD COLUMN IF NOT EXISTS student_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS student_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Add check constraint for status column (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'admission_registry_status_check' 
        AND table_name = 'admission_registry'
    ) THEN
        ALTER TABLE admission_registry 
        ADD CONSTRAINT admission_registry_status_check 
        CHECK (status IN ('pending', 'approved', 'active', 'inactive', 'rejected'));
    END IF;
END $$;

-- Update existing records to have a default status if they don't have one
UPDATE admission_registry 
SET status = 'pending' 
WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE admission_registry 
ALTER COLUMN status SET NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admission_registry_status ON admission_registry(status);
CREATE INDEX IF NOT EXISTS idx_admission_registry_student_email ON admission_registry(student_email);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON admission_registry TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'admission_registry' 
ORDER BY ordinal_position;
