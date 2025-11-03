-- Setup script for outpass requests database
-- Run this script to create the outpass_requests table and related functions

-- Step 1: Create the outpass_requests table
\i create-outpass-requests-table.sql

-- Step 2: Run migration if needed
\i migrate-leave-to-outpass.sql

-- Step 3: Display final summary
SELECT 
    'Database Setup Complete' as status,
    'outpass_requests table created successfully' as message,
    (SELECT COUNT(*) FROM outpass_requests) as total_records;

-- Show table structure
\d outpass_requests;
