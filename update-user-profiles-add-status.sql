-- Update user_profiles table to add status column
-- Run this SQL to add the status field to existing user_profiles table

-- Add the status column
ALTER TABLE user_profiles 
ADD COLUMN status VARCHAR(20) DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete', 'pending_review'));

-- Add index for the new status column
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);

-- Update existing records to set status based on completion
-- This will set status to 'complete' for profiles that have all required fields filled
UPDATE user_profiles 
SET status = CASE 
    WHEN admission_number IS NOT NULL AND admission_number != '' AND
         course IS NOT NULL AND course != '' AND
         batch_year IS NOT NULL AND
         date_of_birth IS NOT NULL AND
         gender IS NOT NULL AND gender != '' AND
         address IS NOT NULL AND address != '' AND
         city IS NOT NULL AND city != '' AND
         state IS NOT NULL AND state != '' AND
         country IS NOT NULL AND country != '' AND
         emergency_contact_name IS NOT NULL AND emergency_contact_name != '' AND
         emergency_contact_phone IS NOT NULL AND emergency_contact_phone != '' AND
         parent_name IS NOT NULL AND parent_name != '' AND
         parent_phone IS NOT NULL AND parent_phone != '' AND
         parent_email IS NOT NULL AND parent_email != '' AND
         aadhar_number IS NOT NULL AND aadhar_number != '' AND
         blood_group IS NOT NULL AND blood_group != ''
    THEN 'complete'
    ELSE 'incomplete'
END;

-- Verify the update
SELECT 
    status,
    COUNT(*) as count
FROM user_profiles 
GROUP BY status;


