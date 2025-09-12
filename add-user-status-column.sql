-- Add status column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'unavailable', 'suspended', 'inactive'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update existing users to have 'available' status if they don't have one
UPDATE users SET status = 'available' WHERE status IS NULL;

