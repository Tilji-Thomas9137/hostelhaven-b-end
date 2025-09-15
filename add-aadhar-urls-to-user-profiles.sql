-- Add missing Aadhar URL columns to user_profiles table
-- This migration adds the required columns for Aadhar document URLs

-- Add aadhar_front_url column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS aadhar_front_url TEXT;

-- Add aadhar_back_url column  
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS aadhar_back_url TEXT;

-- Add pincode column if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);

-- Show confirmation
SELECT 'Aadhar URL columns added to user_profiles table' as status;
SELECT 'Columns added: aadhar_front_url, aadhar_back_url, pincode' as columns_added;
