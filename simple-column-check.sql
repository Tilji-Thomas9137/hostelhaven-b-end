-- Simple script to check what columns exist in admission_registry table
-- Run this in Supabase SQL Editor

-- Check what columns actually exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admission_registry'
ORDER BY ordinal_position;

-- Check if table has any data
SELECT COUNT(*) as total_records FROM admission_registry;

-- Show all data (if any exists)
SELECT * FROM admission_registry LIMIT 5;
