-- ============================================================================
-- CLEAN HOSTELHAVEN TEST DATA
-- ============================================================================
-- This file contains minimal test data for realistic testing flow
-- Only creates 1 user of each role to avoid confusion

-- Clear existing test data first (optional - comment out if you want to keep existing data)
-- DELETE FROM feedback WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM complaints WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM leave_requests WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM payments WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM room_allocations WHERE student_profile_id IN (SELECT id FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com'));
-- DELETE FROM room_requests WHERE student_profile_id IN (SELECT id FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com'));
-- DELETE FROM parents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com');
-- DELETE FROM users WHERE email LIKE '%@hostelhaven.com' OR email LIKE '%@student.edu' OR email LIKE '%@email.com';

-- ============================================================================
-- MINIMAL ADMISSION REGISTRY (Only 1 entry for testing)
-- ============================================================================
INSERT INTO admission_registry (admission_number, student_name, course, batch_year, date_of_birth, gender, address, city, state, country, parent_name, parent_phone, parent_email, aadhar_number, blood_group) VALUES
('TEST001', 'Test Student', 'Computer Science', 2024, '2000-01-15', 'male', '123 Test Street', 'Test City', 'Test State', 'India', 'Test Parent', '+919876543210', 'parent@test.com', '123456789012', 'O+')
ON CONFLICT (admission_number) DO NOTHING;

-- ============================================================================
-- MINIMAL STAFF USERS (1 of each role)
-- ============================================================================

-- Admin User
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('admin-1111-1111-1111-111111111111', 'admin@test.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Test Admin', 'admin', 'admin-auth-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Warden User  
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('warden-2222-2222-2222-222222222222', 'warden@test.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Test Warden', 'warden', 'warden-auth-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Hostel Operations Assistant
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('ops-3333-3333-3333-333333333333', 'ops@test.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Test Operations', 'hostel_operations_assistant', 'ops-auth-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MINIMAL STUDENT USER (1 student for testing)
-- ============================================================================

-- Student User
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('student-4444-4444-4444-444444444444', 'student@test.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Test Student', 'student', 'student-auth-4444-4444-4444-444444444444')
ON CONFLICT (id) DO NOTHING;

-- Student Profile (linked to admission registry)
INSERT INTO user_profiles (id, user_id, admission_number, course, batch_year, date_of_birth, gender, address, city, state, country, emergency_contact_name, emergency_contact_phone, parent_name, parent_phone, parent_email, aadhar_number, blood_group, admission_number_verified, parent_contact_locked) VALUES
('profile-4444-4444-4444-444444444444', 'student-4444-4444-4444-444444444444', 'TEST001', 'Computer Science', 2024, '2000-01-15', 'male', '123 Test Street', 'Test City', 'Test State', 'India', 'Test Parent', '+919876543210', 'Test Parent', '+919876543210', 'parent@test.com', '123456789012', 'O+', true, true)
ON CONFLICT (id) DO NOTHING;

-- Parent User (linked to student)
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('parent-5555-5555-5555-555555555555', 'parent@test.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Test Parent', 'parent', 'parent-auth-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;

-- Parent Profile
INSERT INTO parents (id, user_id, student_profile_id, email, phone, full_name, verified) VALUES
('parent-profile-5555-5555-5555-555555555555', 'parent-5555-5555-5555-555555555555', 'profile-4444-4444-4444-444444444444', 'parent@test.com', '+919876543210', 'Test Parent', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MINIMAL ROOMS (3 rooms for testing)
-- ============================================================================

-- Single Room
INSERT INTO rooms (id, room_number, capacity, room_type, current_occupancy, rent_amount, status, amenities, room_code) VALUES
('room-1111-1111-1111-111111111111', 'S101', 1, 'single', 0, 500.00, 'available', '{"WiFi", "Air Conditioning", "Private Bathroom"}', 'S101')
ON CONFLICT (room_number) DO NOTHING;

-- Double Room
INSERT INTO rooms (id, room_number, capacity, room_type, current_occupancy, rent_amount, status, amenities, room_code) VALUES
('room-2222-2222-2222-222222222222', 'D201', 2, 'double', 0, 400.00, 'available', '{"WiFi", "Air Conditioning", "Shared Bathroom"}', 'D201')
ON CONFLICT (room_number) DO NOTHING;

-- Triple Room
INSERT INTO rooms (id, room_number, capacity, room_type, current_occupancy, rent_amount, status, amenities, room_code) VALUES
('room-3333-3333-3333-333333333333', 'T301', 3, 'triple', 0, 300.00, 'available', '{"WiFi", "Fan", "Shared Bathroom"}', 'T301')
ON CONFLICT (room_number) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Clean test data seeded successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Test Credentials:';
    RAISE NOTICE 'Admin: admin@test.com / Test123!';
    RAISE NOTICE 'Warden: warden@test.com / Test123!';
    RAISE NOTICE 'Operations: ops@test.com / Test123!';
    RAISE NOTICE 'Student: student@test.com / Test123!';
    RAISE NOTICE 'Parent: parent@test.com / Test123!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Test Admission: TEST001 - Test Student';
    RAISE NOTICE '🏠 Available Rooms: S101 (Single), D201 (Double), T301 (Triple)';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Ready for testing the complete hostel management flow!';
END $$;
