-- ============================================================================
-- CLEAR TEST DATA SCRIPT
-- ============================================================================
-- This script removes all test data created by the test-data-seed.sql script
-- Use this if you want to start fresh
-- ============================================================================

-- WARNING: This will delete all test data!
-- Uncomment the sections below to clear specific data

-- Clear test feedback
-- DELETE FROM feedback WHERE student_profile_id IN (
--     SELECT id FROM user_profiles WHERE admission_number LIKE 'ADM%'
-- );

-- Clear test parcels
-- DELETE FROM parcels WHERE student_profile_id IN (
--     SELECT id FROM user_profiles WHERE admission_number LIKE 'ADM%'
-- );

-- Clear test room allocations
-- DELETE FROM room_allocations WHERE student_profile_id IN (
--     SELECT id FROM user_profiles WHERE admission_number LIKE 'ADM%'
-- );

-- Clear test room requests
-- DELETE FROM room_requests WHERE student_profile_id IN (
--     SELECT id FROM user_profiles WHERE admission_number LIKE 'ADM%'
-- );

-- Clear test payments
-- DELETE FROM payments WHERE user_id LIKE 'student-%' OR user_id LIKE 'parent-%';

-- Clear test complaints
-- DELETE FROM complaints WHERE user_id LIKE 'student-%' OR user_id LIKE 'parent-%';

-- Clear test leave requests
-- DELETE FROM leave_requests WHERE user_id LIKE 'student-%' OR user_id LIKE 'parent-%';

-- Clear test parents
-- DELETE FROM parents WHERE user_id LIKE 'parent-%';

-- Clear test user profiles
-- DELETE FROM user_profiles WHERE admission_number LIKE 'ADM%';

-- Clear test users
-- DELETE FROM users WHERE id LIKE 'student-%' OR id LIKE 'parent-%' OR id LIKE 'admin-%' OR id LIKE 'warden-%' OR id LIKE 'hostel-ops-%';

-- Clear test admission registry
-- DELETE FROM admission_registry WHERE admission_number LIKE 'ADM%';

-- Clear test rooms
-- DELETE FROM rooms WHERE id LIKE 'room-%';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CLEAR TEST DATA SCRIPT';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'This script is ready to clear test data.';
    RAISE NOTICE 'Uncomment the DELETE statements above to clear specific data.';
    RAISE NOTICE '========================================';
END $$;
