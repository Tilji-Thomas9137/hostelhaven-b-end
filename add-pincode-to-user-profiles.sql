-- Add pincode column to user_profiles table
-- This script adds the pincode field to the user_profiles table

-- Add pincode column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'pincode'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN pincode VARCHAR(10);
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN user_profiles.pincode IS '6-digit postal code for address location';

-- Update existing records with empty pincode if needed
UPDATE user_profiles SET pincode = '' WHERE pincode IS NULL;
