-- ============================================================================
-- HOSTELHAVEN TEST DATA SEED SCRIPT
-- ============================================================================
-- This script creates test users and data to demonstrate the complete workflow
-- Run this AFTER running the main migration script
-- ============================================================================

-- Clear existing test data (optional - comment out if you want to keep existing data)
-- DELETE FROM feedback WHERE id IN (SELECT id FROM feedback LIMIT 10);
-- DELETE FROM parcels WHERE id IN (SELECT id FROM parcels LIMIT 10);
-- DELETE FROM room_allocations WHERE id IN (SELECT id FROM room_allocations LIMIT 10);
-- DELETE FROM room_requests WHERE id IN (SELECT id FROM room_requests LIMIT 10);
-- DELETE FROM parents WHERE id IN (SELECT id FROM parents LIMIT 10);
-- DELETE FROM user_profiles WHERE id IN (SELECT id FROM user_profiles LIMIT 10);
-- DELETE FROM users WHERE id IN (SELECT id FROM users LIMIT 10);
-- DELETE FROM admission_registry WHERE id IN (SELECT id FROM admission_registry LIMIT 10);

-- ============================================================================
-- ADMISSION REGISTRY DATA
-- ============================================================================

-- Add test admission registry entries (with conflict handling)
INSERT INTO admission_registry (admission_number, student_name, course, batch_year, parent_name, parent_email, parent_phone) VALUES
('ADM001', 'John Smith', 'Computer Science', 2024, 'Robert Smith', 'robert.smith@email.com', '+1234567890'),
('ADM002', 'Sarah Johnson', 'Electrical Engineering', 2024, 'Michael Johnson', 'michael.johnson@email.com', '+1234567891'),
('ADM003', 'David Wilson', 'Mechanical Engineering', 2024, 'Linda Wilson', 'linda.wilson@email.com', '+1234567892'),
('ADM004', 'Emily Brown', 'Computer Science', 2024, 'James Brown', 'james.brown@email.com', '+1234567893'),
('ADM005', 'Michael Davis', 'Civil Engineering', 2024, 'Patricia Davis', 'patricia.davis@email.com', '+1234567894'),
('ADM006', 'Jessica Miller', 'Business Administration', 2024, 'William Miller', 'william.miller@email.com', '+1234567895'),
('ADM007', 'Christopher Garcia', 'Computer Science', 2024, 'Elizabeth Garcia', 'elizabeth.garcia@email.com', '+1234567896'),
('ADM008', 'Amanda Rodriguez', 'Electrical Engineering', 2024, 'Richard Rodriguez', 'richard.rodriguez@email.com', '+1234567897'),
('ADM009', 'Matthew Martinez', 'Mechanical Engineering', 2024, 'Jennifer Martinez', 'jennifer.martinez@email.com', '+1234567898'),
('ADM010', 'Ashley Anderson', 'Civil Engineering', 2024, 'Thomas Anderson', 'thomas.anderson@email.com', '+1234567899')
ON CONFLICT (admission_number) DO NOTHING;

-- ============================================================================
-- STAFF USERS (Admin, Warden, Hostel Operations Assistant)
-- ============================================================================

-- Admin user
INSERT INTO users (id, email, full_name, role, auth_uid, status) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@hostelhaven.com', 'Dr. Admin Manager', 'admin', 'admin-auth-001', 'active')
ON CONFLICT (id) DO NOTHING;

-- Warden user
INSERT INTO users (id, email, full_name, role, auth_uid, status) VALUES
('22222222-2222-2222-2222-222222222222', 'warden@hostelhaven.com', 'Ms. Warden Supervisor', 'warden', 'warden-auth-001', 'active')
ON CONFLICT (id) DO NOTHING;

-- Hostel Operations Assistant
INSERT INTO users (id, email, full_name, role, auth_uid, status) VALUES
('33333333-3333-3333-3333-333333333333', 'operations@hostelhaven.com', 'Mr. Operations Manager', 'hostel_operations_assistant', 'hostel-ops-auth-001', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STUDENT USERS AND PROFILES
-- ============================================================================

-- Create student users linked to admission registry
INSERT INTO users (id, email, full_name, role, auth_uid, status) VALUES
('44444444-4444-4444-4444-444444444441', 'john.smith@student.edu', 'John Smith', 'student', 'student-auth-001', 'active'),
('44444444-4444-4444-4444-444444444442', 'sarah.johnson@student.edu', 'Sarah Johnson', 'student', 'student-auth-002', 'active'),
('44444444-4444-4444-4444-444444444443', 'david.wilson@student.edu', 'David Wilson', 'student', 'student-auth-003', 'active'),
('44444444-4444-4444-4444-444444444444', 'emily.brown@student.edu', 'Emily Brown', 'student', 'student-auth-004', 'active'),
('44444444-4444-4444-4444-444444444445', 'michael.davis@student.edu', 'Michael Davis', 'student', 'student-auth-005', 'active'),
('44444444-4444-4444-4444-444444444446', 'jessica.miller@student.edu', 'Jessica Miller', 'student', 'student-auth-006', 'active'),
('44444444-4444-4444-4444-444444444447', 'christopher.garcia@student.edu', 'Christopher Garcia', 'student', 'student-auth-007', 'active'),
('44444444-4444-4444-4444-444444444448', 'amanda.rodriguez@student.edu', 'Amanda Rodriguez', 'student', 'student-auth-008', 'active'),
('44444444-4444-4444-4444-444444444449', 'matthew.martinez@student.edu', 'Matthew Martinez', 'student', 'student-auth-009', 'active'),
('44444444-4444-4444-4444-444444444450', 'ashley.anderson@student.edu', 'Ashley Anderson', 'student', 'student-auth-010', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create student profiles linked to admission registry
INSERT INTO user_profiles (user_id, admission_number, course, batch_year, parent_name, parent_phone, parent_email, admission_number_verified, parent_contact_locked, status) VALUES
('44444444-4444-4444-4444-444444444441', 'ADM001', 'Computer Science', 2024, 'Robert Smith', '+1234567890', 'robert.smith@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444442', 'ADM002', 'Electrical Engineering', 2024, 'Michael Johnson', '+1234567891', 'michael.johnson@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444443', 'ADM003', 'Mechanical Engineering', 2024, 'Linda Wilson', '+1234567892', 'linda.wilson@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444444', 'ADM004', 'Computer Science', 2024, 'James Brown', '+1234567893', 'james.brown@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444445', 'ADM005', 'Civil Engineering', 2024, 'Patricia Davis', '+1234567894', 'patricia.davis@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444446', 'ADM006', 'Business Administration', 2024, 'William Miller', '+1234567895', 'william.miller@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444447', 'ADM007', 'Computer Science', 2024, 'Elizabeth Garcia', '+1234567896', 'elizabeth.garcia@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444448', 'ADM008', 'Electrical Engineering', 2024, 'Richard Rodriguez', '+1234567897', 'richard.rodriguez@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444449', 'ADM009', 'Mechanical Engineering', 2024, 'Jennifer Martinez', '+1234567898', 'jennifer.martinez@email.com', true, true, 'complete'),
('44444444-4444-4444-4444-444444444450', 'ADM010', 'Civil Engineering', 2024, 'Thomas Anderson', '+1234567899', 'thomas.anderson@email.com', true, true, 'complete')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- PARENT USERS
-- ============================================================================

-- Create parent users (some verified, some not)
INSERT INTO users (id, email, full_name, role, auth_uid, status) VALUES
('55555555-5555-5555-5555-555555555551', 'robert.smith@email.com', 'Robert Smith', 'parent', 'parent-auth-001', 'active'),
('55555555-5555-5555-5555-555555555552', 'michael.johnson@email.com', 'Michael Johnson', 'parent', 'parent-auth-002', 'active'),
('55555555-5555-5555-5555-555555555553', 'linda.wilson@email.com', 'Linda Wilson', 'parent', 'parent-auth-003', 'active'),
('55555555-5555-5555-5555-555555555554', 'james.brown@email.com', 'James Brown', 'parent', 'parent-auth-004', 'active'),
('55555555-5555-5555-5555-555555555555', 'patricia.davis@email.com', 'Patricia Davis', 'parent', 'parent-auth-005', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create parent records with some verified, some pending
INSERT INTO parents (user_id, student_profile_id, email, phone, verified, otp_code, otp_expires_at) VALUES
('55555555-5555-5555-5555-555555555551', (SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'robert.smith@email.com', '+1234567890', true, NULL, NULL),
('55555555-5555-5555-5555-555555555552', (SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'michael.johnson@email.com', '+1234567891', true, NULL, NULL),
('55555555-5555-5555-5555-555555555553', (SELECT id FROM user_profiles WHERE admission_number = 'ADM003'), 'linda.wilson@email.com', '+1234567892', false, '123456', NOW() + INTERVAL '15 minutes'),
('55555555-5555-5555-5555-555555555554', (SELECT id FROM user_profiles WHERE admission_number = 'ADM004'), 'james.brown@email.com', '+1234567893', false, '654321', NOW() + INTERVAL '15 minutes'),
('55555555-5555-5555-5555-555555555555', (SELECT id FROM user_profiles WHERE admission_number = 'ADM005'), 'patricia.davis@email.com', '+1234567894', true, NULL, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- ROOM DATA
-- ============================================================================

-- Ensure we have some rooms with different capacities and statuses
INSERT INTO rooms (id, room_number, floor, room_type, capacity, current_occupancy, price, status, amenities) VALUES
('66666666-6666-6666-6666-666666666661', '101', 1, 'single', 1, 0, 500.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom']),
('66666666-6666-6666-6666-666666666662', '102', 1, 'single', 1, 1, 500.00, 'full', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom']),
('66666666-6666-6666-6666-666666666663', '103', 1, 'double', 2, 1, 400.00, 'partially_filled', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666664', '104', 1, 'double', 2, 0, 400.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666665', '105', 1, 'triple', 3, 2, 300.00, 'partially_filled', ARRAY['WiFi', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666666', '201', 2, 'single', 1, 0, 550.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666667', '202', 2, 'double', 2, 0, 450.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666668', '203', 2, 'triple', 3, 1, 350.00, 'partially_filled', ARRAY['WiFi', 'Shared Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666669', '301', 3, 'single', 1, 0, 600.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom', 'Balcony', 'Study Desk']),
('66666666-6666-6666-6666-666666666670', '302', 3, 'double', 2, 0, 500.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom', 'Balcony', 'Study Desk'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ROOM REQUESTS (Various Statuses)
-- ============================================================================

-- Create some pending room requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM006'), 'room-001', 'allocation', 'pending', 'Prefer single room for better focus on studies'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM007'), 'room-004', 'allocation', 'pending', 'Would like to share with a friend'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM008'), 'room-006', 'allocation', 'pending', 'Need quiet environment for research work');

-- Create some approved requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM009'), 'room-009', 'allocation', 'approved', 'Approved for single room accommodation'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM010'), 'room-010', 'allocation', 'approved', 'Approved for double room accommodation');

-- Create some rejected requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'room-002', 'allocation', 'rejected', 'Room already at full capacity'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'room-005', 'allocation', 'rejected', 'Room type not available');

-- ============================================================================
-- ROOM ALLOCATIONS (For Approved Requests)
-- ============================================================================

-- Create room allocations for approved requests
INSERT INTO room_allocations (student_profile_id, room_id, allocation_status, notes, created_by) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM009'), 'room-009', 'confirmed', 'Single room allocation confirmed', 'warden-001'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM010'), 'room-010', 'confirmed', 'Double room allocation confirmed', 'warden-001');

-- Update room occupancy for allocated rooms
UPDATE rooms SET current_occupancy = 1 WHERE id = 'room-009';
UPDATE rooms SET current_occupancy = 1 WHERE id = 'room-010';
UPDATE rooms SET status = 'full' WHERE id = 'room-009';
UPDATE rooms SET status = 'partially_filled' WHERE id = 'room-010';

-- ============================================================================
-- PARCEL DATA
-- ============================================================================

-- Create some pending parcels
INSERT INTO parcels (student_profile_id, parcel_name, sender_name, sender_phone, token, token_expires_at, status) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'Books and Stationery', 'Robert Smith', '+1234567890', 'test-token-001', NOW() + INTERVAL '24 hours', 'pending'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'Clothing Package', 'Michael Johnson', '+1234567891', 'test-token-002', NOW() + INTERVAL '12 hours', 'pending'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM003'), 'Electronics', 'Linda Wilson', '+1234567892', 'test-token-003', NOW() + INTERVAL '48 hours', 'pending');

-- Create some claimed parcels
INSERT INTO parcels (student_profile_id, parcel_name, sender_name, sender_phone, token, token_expires_at, status, claimed_at, claimed_by) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM004'), 'Food Package', 'James Brown', '+1234567893', 'claimed-token-001', NOW() + INTERVAL '24 hours', 'claimed', NOW() - INTERVAL '2 hours', 'hostel-ops-001'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM005'), 'Medical Supplies', 'Patricia Davis', '+1234567894', 'claimed-token-002', NOW() + INTERVAL '24 hours', 'claimed', NOW() - INTERVAL '1 hour', 'hostel-ops-001');

-- ============================================================================
-- FEEDBACK DATA (With Sentiment Examples)
-- ============================================================================

-- Create some mess feedback with different sentiments
INSERT INTO feedback (student_profile_id, feedback_type, rating, feedback_text, sentiment_label, sentiment_score) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'mess', 5, 'The food quality is excellent and the staff is very friendly!', 'positive', 0.8),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'mess', 3, 'Food is okay but could be better. Some dishes are too salty.', 'neutral', 0.1),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM003'), 'mess', 2, 'Very disappointed with the food quality. Cold food and poor hygiene.', 'negative', -0.7),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM004'), 'mess', 4, 'Good variety in menu and fresh ingredients. Keep it up!', 'positive', 0.6),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM005'), 'mess', 1, 'Terrible experience. Food is always cold and tasteless.', 'negative', -0.9),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM006'), 'mess', 4, 'Love the new menu items. Great improvement in quality.', 'positive', 0.7),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM007'), 'mess', 3, 'Average food quality. Nothing special but edible.', 'neutral', 0.0),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM008'), 'mess', 5, 'Amazing food and service! Thank you for the great meals.', 'positive', 0.9);

-- ============================================================================
-- PAYMENT DATA (Optional - for demonstration)
-- ============================================================================

-- Create some sample payments
INSERT INTO payments (user_id, amount, payment_type, status, due_date, paid_at) VALUES
('student-001', 500.00, 'room_rent', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days'),
('student-002', 500.00, 'room_rent', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days'),
('student-003', 400.00, 'room_rent', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days'),
('student-004', 400.00, 'room_rent', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days'),
('student-005', 300.00, 'room_rent', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days'),
('student-006', 500.00, 'room_rent', 'pending', CURRENT_DATE + INTERVAL '5 days', NULL),
('student-007', 500.00, 'room_rent', 'pending', CURRENT_DATE + INTERVAL '5 days', NULL),
('student-008', 400.00, 'room_rent', 'pending', CURRENT_DATE + INTERVAL '5 days', NULL);

-- ============================================================================
-- COMPLAINTS DATA (Optional - for demonstration)
-- ============================================================================

-- Create some sample complaints
INSERT INTO complaints (user_id, title, description, category, priority, status) VALUES
('student-001', 'WiFi Connection Issues', 'WiFi is very slow in my room and frequently disconnects', 'maintenance', 'high', 'pending'),
('student-002', 'Noisy Neighbors', 'Room next door is very noisy during study hours', 'general', 'medium', 'pending'),
('student-003', 'Water Heater Not Working', 'Hot water is not available in the bathroom', 'maintenance', 'high', 'resolved'),
('student-004', 'Room Cleaning Request', 'Room needs deep cleaning and pest control', 'maintenance', 'medium', 'pending'),
('student-005', 'Food Quality Complaint', 'Mess food quality has deteriorated significantly', 'mess', 'high', 'pending');

-- ============================================================================
-- LEAVE REQUESTS (Optional - for demonstration)
-- ============================================================================

-- Create some sample leave requests
INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES
('student-001', 'emergency', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days', 'Family emergency - need to go home', 'pending'),
('student-002', 'vacation', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '14 days', 'Summer vacation with family', 'approved'),
('student-003', 'medical', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 'Medical appointment and recovery', 'pending'),
('student-004', 'personal', CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days', 'Personal family function', 'approved');

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'HOSTELHAVEN TEST DATA SEEDED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test Users Created:';
    RAISE NOTICE '- Admin: admin@hostelhaven.com';
    RAISE NOTICE '- Warden: warden@hostelhaven.com';
    RAISE NOTICE '- Hostel Operations: operations@hostelhaven.com';
    RAISE NOTICE '- Students: john.smith@student.edu, sarah.johnson@student.edu, etc.';
    RAISE NOTICE '- Parents: robert.smith@email.com, michael.johnson@email.com, etc.';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Data Includes:';
    RAISE NOTICE '- 10 Admission Registry Entries';
    RAISE NOTICE '- 10 Student Profiles (all verified)';
    RAISE NOTICE '- 5 Parent Accounts (3 verified, 2 pending OTP)';
    RAISE NOTICE '- 10 Rooms (various types and availability)';
    RAISE NOTICE '- 7 Room Requests (3 pending, 2 approved, 2 rejected)';
    RAISE NOTICE '- 5 Parcels (3 pending, 2 claimed)';
    RAISE NOTICE '- 8 Mess Feedback (various sentiments)';
    RAISE NOTICE '- Sample Payments, Complaints, and Leave Requests';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now test the complete workflow!';
    RAISE NOTICE '========================================';
END $$;
