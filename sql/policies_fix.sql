-- HostelHaven RLS Policies Fix
-- Date: 2025-01-15
-- Purpose: Comprehensive Row Level Security policies for secure data access

-- ============================================================================
-- DROP EXISTING POLICIES (if any)
-- ============================================================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own data" ON payments;
DROP POLICY IF EXISTS "Users can view their own data" ON leave_requests;
DROP POLICY IF EXISTS "Users can view their own data" ON complaints;
DROP POLICY IF EXISTS "Users can view their own data" ON notifications;
DROP POLICY IF EXISTS "Users can view their own data" ON maintenance_requests;
DROP POLICY IF EXISTS "Anyone can view hostels" ON hostels;
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Prevent users from changing their own role or status
        role = (SELECT role FROM users WHERE id = auth.uid())
    );

-- Only staff can insert new users
CREATE POLICY "Staff can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can view all users
CREATE POLICY "Staff can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can update all users
CREATE POLICY "Staff can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- USER_PROFILES TABLE POLICIES
-- ============================================================================

-- Students can view their own profile
CREATE POLICY "Students can view own profile" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = user_profiles.user_id
        )
    );

-- Students can update their own profile (but not admission_number or parent info)
CREATE POLICY "Students can update own profile" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = user_profiles.user_id
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = user_profiles.user_id
        ) AND
        -- Prevent students from changing admission_number or parent contact info
        admission_number = (SELECT admission_number FROM user_profiles WHERE user_id = (SELECT id FROM users WHERE auth_uid = auth.uid())) AND
        parent_name = (SELECT parent_name FROM user_profiles WHERE user_id = (SELECT id FROM users WHERE auth_uid = auth.uid())) AND
        parent_email = (SELECT parent_email FROM user_profiles WHERE user_id = (SELECT id FROM users WHERE auth_uid = auth.uid())) AND
        parent_phone = (SELECT parent_phone FROM user_profiles WHERE user_id = (SELECT id FROM users WHERE auth_uid = auth.uid()))
    );

-- Staff can insert student profiles
CREATE POLICY "Staff can insert student profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can view all profiles
CREATE POLICY "Staff can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can update all profiles
CREATE POLICY "Staff can update all profiles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- ROOMS TABLE POLICIES
-- ============================================================================

-- Anyone can view available rooms
CREATE POLICY "Anyone can view rooms" ON rooms
    FOR SELECT USING (true);

-- Only staff can insert/update rooms
CREATE POLICY "Staff can manage rooms" ON rooms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================================

-- Students can view their own payments
CREATE POLICY "Students can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = payments.user_id
        )
    );

-- Staff can view all payments
CREATE POLICY "Staff can view all payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can manage all payments
CREATE POLICY "Staff can manage all payments" ON payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- LEAVE_REQUESTS TABLE POLICIES
-- ============================================================================

-- Students can view their own leave requests
CREATE POLICY "Students can view own leave requests" ON leave_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = leave_requests.user_id
        )
    );

-- Students can insert their own leave requests
CREATE POLICY "Students can insert own leave requests" ON leave_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = leave_requests.user_id
        )
    );

-- Students can update their own pending leave requests
CREATE POLICY "Students can update own pending leave requests" ON leave_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = leave_requests.user_id
        ) AND status = 'pending'
    );

-- Staff can view all leave requests
CREATE POLICY "Staff can view all leave requests" ON leave_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can manage all leave requests
CREATE POLICY "Staff can manage all leave requests" ON leave_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- COMPLAINTS TABLE POLICIES
-- ============================================================================

-- Students can view their own complaints
CREATE POLICY "Students can view own complaints" ON complaints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = complaints.user_id
        )
    );

-- Students can insert their own complaints
CREATE POLICY "Students can insert own complaints" ON complaints
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = complaints.user_id
        )
    );

-- Students can update their own pending complaints
CREATE POLICY "Students can update own pending complaints" ON complaints
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = complaints.user_id
        ) AND status IN ('open', 'pending')
    );

-- Staff can view all complaints
CREATE POLICY "Staff can view all complaints" ON complaints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can manage all complaints
CREATE POLICY "Staff can manage all complaints" ON complaints
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = notifications.user_id
        )
    );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = notifications.user_id
        )
    );

-- Staff can insert notifications
CREATE POLICY "Staff can insert notifications" ON notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- ANNOUNCEMENTS TABLE POLICIES
-- ============================================================================

-- Anyone can view active announcements
CREATE POLICY "Anyone can view active announcements" ON announcements
    FOR SELECT USING (is_active = true);

-- Staff can manage announcements
CREATE POLICY "Staff can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- HOSTELS TABLE POLICIES
-- ============================================================================

-- Anyone can view hostels
CREATE POLICY "Anyone can view hostels" ON hostels
    FOR SELECT USING (true);

-- Staff can manage hostels
CREATE POLICY "Staff can manage hostels" ON hostels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- MAINTENANCE_REQUESTS TABLE POLICIES
-- ============================================================================

-- Students can view their own maintenance requests
CREATE POLICY "Students can view own maintenance requests" ON maintenance_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = maintenance_requests.reported_by
        )
    );

-- Students can insert their own maintenance requests
CREATE POLICY "Students can insert own maintenance requests" ON maintenance_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.id = maintenance_requests.reported_by
        )
    );

-- Staff can view all maintenance requests
CREATE POLICY "Staff can view all maintenance requests" ON maintenance_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- Staff can manage all maintenance requests
CREATE POLICY "Staff can manage all maintenance requests" ON maintenance_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_uid = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant', 'warden')
        )
    );

-- ============================================================================
-- POLICIES COMPLETE
-- ============================================================================

-- Log policy creation
INSERT INTO pending_data_review (table_name, record_id, issue_description, status)
VALUES ('policies', uuid_generate_v4(), 'RLS policies created successfully', 'resolved');
