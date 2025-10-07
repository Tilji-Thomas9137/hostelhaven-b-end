-- ============================================================================
-- HOSTELHAVEN TEST DATA SEED SCRIPT (UUID FIXED VERSION)
-- ============================================================================
-- This script creates test users and data to demonstrate the complete workflow
-- Run this AFTER running the main migration script
-- This version uses proper UUIDs for all ID fields
-- ============================================================================

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
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@hostelhaven.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Dr. Admin Manager', 'admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- Warden user
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('22222222-2222-2222-2222-222222222222', 'warden@hostelhaven.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Ms. Warden Supervisor', 'warden', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- Hostel Operations Assistant
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('33333333-3333-3333-3333-333333333333', 'operations@hostelhaven.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Mr. Operations Manager', 'hostel_operations_assistant', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STUDENT USERS AND PROFILES
-- ============================================================================

-- Create student users linked to admission registry
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('44444444-4444-4444-4444-444444444441', 'john.smith@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'John Smith', 'student', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
('44444444-4444-4444-4444-444444444442', 'sarah.johnson@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Sarah Johnson', 'student', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
('44444444-4444-4444-4444-444444444443', 'david.wilson@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'David Wilson', 'student', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
('44444444-4444-4444-4444-444444444444', 'emily.brown@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Emily Brown', 'student', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
('44444444-4444-4444-4444-444444444445', 'michael.davis@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Michael Davis', 'student', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'),
('44444444-4444-4444-4444-444444444446', 'jessica.miller@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Jessica Miller', 'student', 'cccccccc-dddd-eeee-ffff-000000000000'),
('44444444-4444-4444-4444-444444444447', 'christopher.garcia@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Christopher Garcia', 'student', 'dddddddd-eeee-ffff-0000-111111111111'),
('44444444-4444-4444-4444-444444444448', 'amanda.rodriguez@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Amanda Rodriguez', 'student', 'eeeeeeee-ffff-0000-1111-222222222222'),
('44444444-4444-4444-4444-444444444449', 'matthew.martinez@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Matthew Martinez', 'student', 'ffffffff-0000-1111-2222-333333333333'),
('44444444-4444-4444-4444-444444444450', 'ashley.anderson@student.edu', '$2a$10$placeholder.hash.for.supabase.auth', 'Ashley Anderson', 'student', '00000000-1111-2222-3333-444444444444')
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
INSERT INTO users (id, email, password_hash, full_name, role, auth_uid) VALUES
('55555555-5555-5555-5555-555555555551', 'robert.smith@email.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Robert Smith', 'parent', '11111111-2222-3333-4444-555555555555'),
('55555555-5555-5555-5555-555555555552', 'michael.johnson@email.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Michael Johnson', 'parent', '22222222-3333-4444-5555-666666666666'),
('55555555-5555-5555-5555-555555555553', 'linda.wilson@email.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Linda Wilson', 'parent', '33333333-4444-5555-6666-777777777777'),
('55555555-5555-5555-5555-555555555554', 'james.brown@email.com', '$2a$10$placeholder.hash.for.supabase.auth', 'James Brown', 'parent', '44444444-5555-6666-7777-888888888888'),
('55555555-5555-5555-5555-555555555555', 'patricia.davis@email.com', '$2a$10$placeholder.hash.for.supabase.auth', 'Patricia Davis', 'parent', '55555555-6666-7777-8888-999999999999')
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
('66666666-6666-6666-6666-666666666661', 'T101', 1, 'single', 1, 0, 500.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom']),
('66666666-6666-6666-6666-666666666662', 'T102', 1, 'single', 1, 1, 500.00, 'full', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom']),
('66666666-6666-6666-6666-666666666663', 'T103', 1, 'double', 2, 1, 400.00, 'partially_filled', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666664', 'T104', 1, 'double', 2, 0, 400.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666665', 'T105', 1, 'triple', 3, 2, 300.00, 'partially_filled', ARRAY['WiFi', 'Shared Bathroom']),
('66666666-6666-6666-6666-666666666666', 'T201', 2, 'single', 1, 0, 550.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666667', 'T202', 2, 'double', 2, 0, 450.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666668', 'T203', 2, 'triple', 3, 1, 350.00, 'partially_filled', ARRAY['WiFi', 'Shared Bathroom', 'Balcony']),
('66666666-6666-6666-6666-666666666669', 'T301', 3, 'single', 1, 0, 600.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Private Bathroom', 'Balcony', 'Study Desk']),
('66666666-6666-6666-6666-666666666670', 'T302', 3, 'double', 2, 0, 500.00, 'available', ARRAY['WiFi', 'Air Conditioning', 'Shared Bathroom', 'Balcony', 'Study Desk'])
ON CONFLICT (room_number) DO NOTHING;

-- ============================================================================
-- ROOM REQUESTS (Various Statuses)
-- ============================================================================

-- Create some pending room requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM006'), '66666666-6666-6666-6666-666666666661', 'allocation', 'pending', 'Prefer single room for better focus on studies'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM007'), '66666666-6666-6666-6666-666666666664', 'allocation', 'pending', 'Would like to share with a friend'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM008'), '66666666-6666-6666-6666-666666666666', 'allocation', 'pending', 'Need quiet environment for research work')
ON CONFLICT DO NOTHING;

-- Create some approved requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM009'), '66666666-6666-6666-6666-666666666669', 'allocation', 'approved', 'Approved for single room accommodation'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM010'), '66666666-6666-6666-6666-666666666670', 'allocation', 'approved', 'Approved for double room accommodation')
ON CONFLICT DO NOTHING;

-- Create some rejected requests
INSERT INTO room_requests (student_profile_id, room_id, request_type, status, notes) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), '66666666-6666-6666-6666-666666666662', 'allocation', 'rejected', 'Room already at full capacity'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), '66666666-6666-6666-6666-666666666665', 'allocation', 'rejected', 'Room type not available')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROOM ALLOCATIONS (For Approved Requests)
-- ============================================================================

-- Create room allocations for approved requests
INSERT INTO room_allocations (student_profile_id, room_id, allocation_status, notes, created_by) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM009'), '66666666-6666-6666-6666-666666666669', 'confirmed', 'Single room allocation confirmed', '22222222-2222-2222-2222-222222222222'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM010'), '66666666-6666-6666-6666-666666666670', 'confirmed', 'Double room allocation confirmed', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Update room occupancy for allocated rooms
UPDATE rooms SET current_occupancy = 1 WHERE id = '66666666-6666-6666-6666-666666666669' AND current_occupancy = 0;
UPDATE rooms SET current_occupancy = 1 WHERE id = '66666666-6666-6666-6666-666666666670' AND current_occupancy = 0;
UPDATE rooms SET status = 'full' WHERE id = '66666666-6666-6666-6666-666666666669' AND current_occupancy = 1;
UPDATE rooms SET status = 'partially_filled' WHERE id = '66666666-6666-6666-6666-666666666670' AND current_occupancy = 1;

-- ============================================================================
-- PARCEL DATA
-- ============================================================================

-- Create some pending parcels
INSERT INTO parcels (student_profile_id, parcel_name, sender_name, sender_phone, token, token_expires_at, status) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'Books and Stationery', 'Robert Smith', '+1234567890', 'test-token-001', NOW() + INTERVAL '24 hours', 'pending'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'Clothing Package', 'Michael Johnson', '+1234567891', 'test-token-002', NOW() + INTERVAL '12 hours', 'pending'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM003'), 'Electronics', 'Linda Wilson', '+1234567892', 'test-token-003', NOW() + INTERVAL '48 hours', 'pending')
ON CONFLICT DO NOTHING;

-- Create some claimed parcels
INSERT INTO parcels (student_profile_id, parcel_name, sender_name, sender_phone, token, token_expires_at, status, claimed_at, claimed_by) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM004'), 'Food Package', 'James Brown', '+1234567893', 'claimed-token-001', NOW() + INTERVAL '24 hours', 'claimed', NOW() - INTERVAL '2 hours', '33333333-3333-3333-3333-333333333333'),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM005'), 'Medical Supplies', 'Patricia Davis', '+1234567894', 'claimed-token-002', NOW() + INTERVAL '24 hours', 'claimed', NOW() - INTERVAL '1 hour', '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FEEDBACK DATA (With Sentiment Examples)
-- ============================================================================

-- Create some mess feedback with different sentiments
INSERT INTO feedback (student_profile_id, feedback_type, rating, text_content, sentiment_label, sentiment_score) VALUES
((SELECT id FROM user_profiles WHERE admission_number = 'ADM001'), 'mess', 5, 'The food quality is excellent and the staff is very friendly!', 'positive', 0.8),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM002'), 'mess', 3, 'Food is okay but could be better. Some dishes are too salty.', 'neutral', 0.1),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM003'), 'mess', 2, 'Very disappointed with the food quality. Cold food and poor hygiene.', 'negative', -0.7),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM004'), 'mess', 4, 'Good variety in menu and fresh ingredients. Keep it up!', 'positive', 0.6),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM005'), 'mess', 1, 'Terrible experience. Food is always cold and tasteless.', 'negative', -0.9),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM006'), 'mess', 4, 'Love the new menu items. Great improvement in quality.', 'positive', 0.7),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM007'), 'mess', 3, 'Average food quality. Nothing special but edible.', 'neutral', 0.0),
((SELECT id FROM user_profiles WHERE admission_number = 'ADM008'), 'mess', 5, 'Amazing food and service! Thank you for the great meals.', 'positive', 0.9)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PAYMENT DATA
-- ============================================================================

-- Create some sample payments
INSERT INTO payments (user_id, amount, payment_type, payment_method, status, due_date, paid_at, notes) VALUES
('44444444-4444-4444-4444-444444444441', 500.00, 'room_rent', 'cash', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'Monthly room rent - September'),
('44444444-4444-4444-4444-444444444442', 500.00, 'room_rent', 'bank_transfer', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'Monthly room rent - September'),
('44444444-4444-4444-4444-444444444443', 400.00, 'room_rent', 'online', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'Monthly room rent - September'),
('44444444-4444-4444-4444-444444444444', 400.00, 'room_rent', 'cash', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'Monthly room rent - September'),
('44444444-4444-4444-4444-444444444445', 300.00, 'room_rent', 'cheque', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '5 days', 'Monthly room rent - September'),
('44444444-4444-4444-4444-444444444446', 500.00, 'room_rent', 'cash', 'pending', CURRENT_DATE + INTERVAL '5 days', NULL, 'Monthly room rent - October'),
('44444444-4444-4444-4444-444444444447', 500.00, 'room_rent', 'bank_transfer', 'pending', CURRENT_DATE + INTERVAL '5 days', NULL, 'Monthly room rent - October'),
('44444444-4444-4444-4444-444444444448', 400.00, 'room_rent', 'online', 'overdue', CURRENT_DATE - INTERVAL '2 days', NULL, 'Monthly room rent - September (Overdue)')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMPLAINTS DATA
-- ============================================================================

-- Create some sample complaints
INSERT INTO complaints (user_id, title, description, category, priority, status, resolution_notes, resolved_at) VALUES
('44444444-4444-4444-4444-444444444441', 'WiFi Connection Issues', 'WiFi is very slow in my room and frequently disconnects. Cannot attend online classes properly.', 'facilities', 'high', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444442', 'Noisy Neighbors', 'Room next door is very noisy during study hours (10 PM - 6 AM). Cannot concentrate on studies.', 'noise', 'medium', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444443', 'Water Heater Not Working', 'Hot water is not available in the bathroom for the past 3 days. Very inconvenient.', 'maintenance', 'high', 'resolved', 'Water heater repaired. Technician visited and fixed the issue.', NOW() - INTERVAL '1 day'),
('44444444-4444-4444-4444-444444444444', 'Room Cleaning Request', 'Room needs deep cleaning and pest control. Found cockroaches in the bathroom.', 'cleanliness', 'medium', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444445', 'Mess Food Quality Complaint', 'Mess food quality has deteriorated significantly. Food is often cold and tasteless.', 'food', 'high', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444446', 'Security Issue', 'Main gate is often left unlocked during night hours. Security concern for all residents.', 'security', 'urgent', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444447', 'AC Not Working', 'Air conditioning unit in room is not cooling properly. Makes loud noise.', 'maintenance', 'high', 'in_progress', 'Technician scheduled for tomorrow morning.', NULL),
('44444444-4444-4444-4444-444444444448', 'Laundry Service Issue', 'Laundry service is not picking up clothes on time. Delayed by 2-3 days regularly.', 'facilities', 'medium', 'resolved', 'Spoke with laundry service provider. They have increased their pickup frequency.', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LEAVE REQUESTS (Outpass System)
-- ============================================================================

-- Create some sample leave requests
INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, departure_time, return_time, destination, reason, emergency_contact_name, emergency_contact_phone, status, outpass_number, approved_by) VALUES
('44444444-4444-4444-4444-444444444441', 'emergency', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days', '06:00', '18:00', 'Delhi', 'Family emergency - need to go home immediately', 'Robert Smith', '+1234567890', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444442', 'vacation', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '14 days', '08:00', '20:00', 'Mumbai', 'Summer vacation with family', 'Michael Johnson', '+1234567891', 'approved', 'OUT-2024-001', '22222222-2222-2222-2222-222222222222'),
('44444444-4444-4444-4444-444444444443', 'medical', CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', '09:00', '17:00', 'Chennai', 'Medical appointment and recovery period', 'Linda Wilson', '+1234567892', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444444', 'personal', CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days', '07:00', '19:00', 'Bangalore', 'Personal family function - sister wedding', 'James Brown', '+1234567893', 'approved', 'OUT-2024-002', '22222222-2222-2222-2222-222222222222'),
('44444444-4444-4444-4444-444444444445', 'academic', CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', '10:00', '16:00', 'Pune', 'Academic conference presentation', 'Patricia Davis', '+1234567894', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444446', 'medical', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 day', '08:30', '18:30', 'Kolkata', 'Dental surgery and recovery', 'William Miller', '+1234567895', 'approved', 'OUT-2024-003', '22222222-2222-2222-2222-222222222222'),
('44444444-4444-4444-4444-444444444447', 'emergency', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', '05:00', '22:00', 'Hyderabad', 'Family member hospitalized - need to visit', 'Elizabeth Garcia', '+1234567896', 'pending', NULL, NULL),
('44444444-4444-4444-4444-444444444448', 'personal', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '17 days', '06:30', '20:30', 'Ahmedabad', 'Personal work - property documentation', 'Richard Rodriguez', '+1234567897', 'approved', 'OUT-2024-004', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

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
    RAISE NOTICE 'Next: Run the credential setup script to create auth users.';
    RAISE NOTICE '========================================';
END $$;
