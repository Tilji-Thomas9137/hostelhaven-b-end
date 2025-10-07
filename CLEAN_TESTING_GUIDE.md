# 🏠 HostelHaven Clean Testing Guide

This guide provides a step-by-step process to test the complete HostelHaven hostel management system with minimal, clean test data.

## 🚀 Quick Setup

### 1. Clear Existing Data (Optional)
If you have existing test data that might interfere:
```bash
# In backend directory
psql -h your-supabase-host -U postgres -d postgres -f sql/clear-test-data.sql
```

### 2. Run Clean Migration
```bash
# Apply the main schema migration
psql -h your-supabase-host -U postgres -d postgres -f sql/2025-01-15-fix-hostelhaven-schema.sql
```

### 3. Seed Clean Test Data
```bash
# Add minimal test data
psql -h your-supabase-host -U postgres -d postgres -f sql/clean-test-data.sql
```

### 4. Set Up Authentication
```bash
# Create auth users
node scripts/setup-clean-test-users.js
```

### 5. Start Servers
```bash
# Backend (in hostelhaven-b-end directory)
node server.js

# Frontend (in hostelhaven-f-end directory, new terminal)
npm run dev
```

## 🔐 Clean Test Credentials

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| **Admin** | `admin@test.com` | `Test123!` | `/admin-dashboard` |
| **Warden** | `warden@test.com` | `Test123!` | `/warden-dashboard` |
| **Operations** | `ops@test.com` | `Test123!` | `/operations-dashboard` |
| **Student** | `student@test.com` | `Test123!` | `/student-dashboard` |
| **Parent** | `parent@test.com` | `Test123!` | `/parent-dashboard` |

## 🧪 Complete Testing Flow

### Phase 1: Login & Role-Based Redirects

1. **Go to**: `http://localhost:5173/login`

2. **Test Admin Login**:
   - Email: `admin@test.com`
   - Password: `Test123!`
   - ✅ Should redirect to `/admin-dashboard`
   - ✅ Should see admin-specific features

3. **Test Warden Login**:
   - Email: `warden@test.com`
   - Password: `Test123!`
   - ✅ Should redirect to `/warden-dashboard`
   - ✅ Should see warden-specific features

4. **Test Operations Login**:
   - Email: `ops@test.com`
   - Password: `Test123!`
   - ✅ Should redirect to `/operations-dashboard`
   - ✅ Should see operations-specific features

5. **Test Student Login**:
   - Email: `student@test.com`
   - Password: `Test123!`
   - ✅ Should redirect to `/student-dashboard`
   - ✅ Should see student-specific features

6. **Test Parent Login**:
   - Email: `parent@test.com`
   - Password: `Test123!`
   - ✅ Should redirect to `/parent-dashboard`
   - ✅ Should see parent-specific features

### Phase 2: Student Admission Flow

#### Step 1: Add New Student (Operations Assistant)

1. **Login as Operations**: `ops@test.com` / `Test123!`

2. **Add Admission Registry Entry**:
   - Go to Operations Dashboard
   - Find "Admission Registry" section
   - Add new entry:
     ```
     Admission Number: ADM002
     Student Name: New Student
     Course: Electrical Engineering
     Batch Year: 2024
     Date of Birth: 2001-05-20
     Gender: female
     Address: 456 New Street
     City: New City
     State: New State
     Country: India
     Parent Name: New Parent
     Parent Phone: +919876543211
     Parent Email: newparent@test.com
     Aadhar Number: 987654321098
     Blood Group: A+
     ```

3. **Create Student Account**:
   - Use API endpoint: `POST /api/hostel_assistant/create-student`
   - Or use Operations Dashboard UI
   - Input:
     ```json
     {
       "admission_number": "ADM002",
       "email": "newstudent@test.com",
       "password": "Student123!"
     }
     ```

4. **Verify Student Creation**:
   - ✅ Student account created in `users` table
   - ✅ Student profile created in `user_profiles` table
   - ✅ Parent account created automatically
   - ✅ Parent profile created in `parents` table

#### Step 2: Test New Student Login

1. **Login as New Student**: `newstudent@test.com` / `Student123!`
2. **Verify**: Should redirect to `/student-dashboard`
3. **Check**: Student profile should be complete and verified

### Phase 3: Room Request & Allocation Flow

#### Step 1: Student Requests Room

1. **Login as Student**: `student@test.com` / `Test123!`

2. **View Available Rooms**:
   - Go to "Room Requests" tab
   - ✅ Should see: S101 (Single), D201 (Double), T301 (Triple)
   - ✅ All rooms should show capacity (1/1, 2/2, 3/3)

3. **Submit Room Request**:
   - Select room: D201 (Double)
   - Add notes: "Prefer double room for study partner"
   - Submit request

4. **Verify Request**:
   - ✅ Request created in `room_requests` table
   - ✅ Status: "pending"
   - ✅ Room still shows as available

#### Step 2: Warden Approves Request

1. **Login as Warden**: `warden@test.com` / `Test123!`

2. **View Pending Requests**:
   - Go to "Room Requests" tab
   - ✅ Should see pending request from student

3. **Approve Request**:
   - Review student details
   - Click "Approve"
   - ✅ Request status: "approved"
   - ✅ Room allocation created
   - ✅ Room occupancy updated (1/2)
   - ✅ Room status: "partially_filled"

#### Step 3: Verify Room Capacity Logic

1. **Login as Another Student** (create if needed)

2. **Try to Request Same Room**:
   - Room D201 should still be available (1/2)
   - Should be able to request it

3. **Fill Room to Capacity**:
   - Approve second request
   - ✅ Room occupancy: 2/2
   - ✅ Room status: "full"
   - ✅ Room disappears from available list

### Phase 4: Parent Verification Flow

#### Step 1: Test Parent Access

1. **Login as Parent**: `parent@test.com` / `Test123!`

2. **Verify Parent Dashboard**:
   - ✅ Should see linked student information
   - ✅ Should see student's room allocation
   - ✅ Should see payment status
   - ✅ Should see leave requests

#### Step 2: Test New Parent (from new student)

1. **Login as New Parent**: `newparent@test.com` / `Parent123!`

2. **Verify**: Should see new student's information

### Phase 5: Additional Features Testing

#### Room Management

1. **Login as Operations**: `ops@test.com` / `Test123!`

2. **Test Room Features**:
   - ✅ View all rooms
   - ✅ Check occupancy status
   - ✅ Update room details

#### Payment Tracking

1. **Login as Student**: `student@test.com` / `Test123!`

2. **Check Payments**:
   - ✅ View payment history
   - ✅ See due dates
   - ✅ Check payment status

#### Leave Requests

1. **Login as Student**: `student@test.com` / `Test123!`

2. **Submit Leave Request**:
   - Leave type: "personal"
   - Start date: Tomorrow
   - End date: Day after tomorrow
   - Reason: "Family function"
   - Submit

3. **Login as Warden**: `warden@test.com` / `Test123!`

4. **Approve Leave Request**:
   - ✅ View pending requests
   - ✅ Approve with outpass number

#### Complaints

1. **Login as Student**: `student@test.com` / `Test123!`

2. **Submit Complaint**:
   - Title: "WiFi Issues"
   - Category: "maintenance"
   - Description: "WiFi is slow in my room"
   - Submit

3. **Login as Warden**: `warden@test.com` / `Test123!`

4. **Manage Complaint**:
   - ✅ View complaint
   - ✅ Update status
   - ✅ Add resolution notes

## ✅ Expected Results

### Login Flow
- ✅ Automatic role detection
- ✅ Proper dashboard redirects
- ✅ No manual role selection needed

### Student Creation
- ✅ Only staff can create students
- ✅ Students must exist in admission registry
- ✅ Parent accounts created automatically
- ✅ Proper validation on all fields

### Room Allocation
- ✅ Capacity-aware allocation
- ✅ Real-time occupancy updates
- ✅ Rooms disappear when full
- ✅ Proper approval workflow

### Data Integrity
- ✅ No duplicate users
- ✅ Proper foreign key relationships
- ✅ Clean, minimal test data
- ✅ Easy to add new records

## 🔧 Troubleshooting

### Common Issues

1. **"Network error: Failed to fetch"**
   - ✅ Backend server not running
   - ✅ Solution: Start backend with `node server.js`

2. **"Invalid email or password"**
   - ✅ Auth users not created
   - ✅ Solution: Run `node scripts/setup-clean-test-users.js`

3. **"Admission number not found"**
   - ✅ Clean data not seeded
   - ✅ Solution: Run `psql -f sql/clean-test-data.sql`

4. **Role redirect not working**
   - ✅ Check user role in database
   - ✅ Verify auth_uid is set correctly

### Database Verification

```sql
-- Check users and roles
SELECT email, role, auth_uid FROM users ORDER BY role;

-- Check admission registry
SELECT admission_number, student_name, parent_email FROM admission_registry;

-- Check room availability
SELECT room_number, capacity, current_occupancy, status FROM rooms;

-- Check room requests
SELECT rr.status, u.email, r.room_number 
FROM room_requests rr 
JOIN users u ON rr.student_profile_id = u.id 
JOIN rooms r ON rr.room_id = r.id;
```

## 🎯 Success Criteria

You should be able to:

1. ✅ **Login as any role** and be automatically redirected to the correct dashboard
2. ✅ **Create new students** through the Operations dashboard
3. ✅ **Request and allocate rooms** with proper capacity management
4. ✅ **Verify parent accounts** are created automatically
5. ✅ **Test all major features** without data conflicts
6. ✅ **Add new records** without interference from seed data

The system should feel like a real hostel management system with proper workflows and validation!
