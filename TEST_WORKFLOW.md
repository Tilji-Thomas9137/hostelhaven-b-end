# HostelHaven Test Workflow Guide

This guide explains how to test the complete HostelHaven workflow using the seeded test data.

## 🚀 Quick Setup

1. **Run the migration** (if not already done):
   ```bash
   # Apply the main schema migration
   psql -h your-supabase-host -U postgres -d postgres -f sql/2025-01-15-fix-hostelhaven-schema.sql
   ```

2. **Seed test data**:
   ```bash
   # Add test users and data
   psql -h your-supabase-host -U postgres -d postgres -f sql/test-data-seed.sql
   ```

3. **Set up authentication credentials**:
   
   **Option A: Automated Setup (Recommended)**
   ```bash
   # Windows
   setup-test-users.bat
   
   # Linux/Mac
   chmod +x setup-test-users.sh
   ./setup-test-users.sh
   
   # Or run directly
   node scripts/setup-test-credentials.js
   ```
   
   **Option B: Manual Setup**
   - Go to Supabase Dashboard → Authentication → Users
   - Create users with the credentials listed below
   - Mark emails as confirmed

## 👥 Test User Accounts

### Staff Accounts
- **Admin**: `admin@hostelhaven.com` / `Admin123!` (Role: admin)
- **Warden**: `warden@hostelhaven.com` / `Warden123!` (Role: warden)  
- **Hostel Operations**: `operations@hostelhaven.com` / `Ops123!` (Role: hostel_operations_assistant)

### Student Accounts
- **John Smith**: `john.smith@student.edu` (ADM001, Computer Science)
- **Sarah Johnson**: `sarah.johnson@student.edu` (ADM002, Electrical Engineering)
- **David Wilson**: `david.wilson@student.edu` (ADM003, Mechanical Engineering)
- **Emily Brown**: `emily.brown@student.edu` (ADM004, Computer Science)
- **Michael Davis**: `michael.davis@student.edu` (ADM005, Civil Engineering)
- **Jessica Miller**: `jessica.miller@student.edu` (ADM006, Business Administration)
- **Christopher Garcia**: `christopher.garcia@student.edu` (ADM007, Computer Science)
- **Amanda Rodriguez**: `amanda.rodriguez@student.edu` (ADM008, Electrical Engineering)
- **Matthew Martinez**: `matthew.martinez@student.edu` (ADM009, Mechanical Engineering)
- **Ashley Anderson**: `ashley.anderson@student.edu` (ADM010, Civil Engineering)

### Parent Accounts
- **Robert Smith**: `robert.smith@email.com` (✅ Verified, Parent of John Smith)
- **Michael Johnson**: `michael.johnson@email.com` (✅ Verified, Parent of Sarah Johnson)
- **Linda Wilson**: `linda.wilson@email.com` (❌ Pending OTP: 123456, Parent of David Wilson)
- **James Brown**: `james.brown@email.com` (❌ Pending OTP: 654321, Parent of Emily Brown)
- **Patricia Davis**: `patricia.davis@email.com` (✅ Verified, Parent of Michael Davis)

## 🧪 Testing Workflows

### 1. **Staff Student Creation Workflow**
**Test as Hostel Operations Assistant (`operations@hostelhaven.com`)**

1. **Create a new student**:
   - Use API: `POST /api/hostel_assistant/create-student`
   - Input: `admission_number: "ADM011", email: "newstudent@student.edu", password: "password123"`
   - This will:
     - Create student user account
     - Link to admission registry (ADM011 needs to be added first)
     - Create parent account with OTP verification
     - Send OTP email to parent

2. **Verify parent account**:
   - Use API: `POST /api/parents/verify-otp`
   - Input: `otp_code: "123456", parent_email: "newparent@email.com"`

### 2. **Room Request & Allocation Workflow**
**Test as Student (`john.smith@student.edu`)**

1. **View available rooms**:
   - Use API: `GET /api/rooms/available`
   - Should show rooms with `current_occupancy < capacity`

2. **Submit room request**:
   - Use API: `POST /api/rooms/request`
   - Input: `room_id: "room-001", notes: "Prefer single room"`

3. **Check request status**:
   - Use API: `GET /api/rooms/requests`
   - Should show pending request

**Test as Warden (`warden@hostelhaven.com`)**

4. **View pending requests**:
   - Use API: `GET /api/rooms/pending-requests`
   - Should show John's request

5. **Approve request**:
   - Use API: `POST /api/rooms/approve`
   - Input: `request_id: "<request-id>", action: "approve", notes: "Approved"`

6. **Verify allocation**:
   - Check `room_allocations` table
   - Verify room occupancy updated

### 3. **Parent Verification Workflow**
**Test as Parent (`linda.wilson@email.com`)**

1. **Login attempt** (should be blocked):
   - Try to login with parent credentials
   - Should get message about OTP verification needed

2. **Verify OTP**:
   - Use API: `POST /api/parents/verify-otp`
   - Input: `otp_code: "123456", parent_email: "linda.wilson@email.com"`

3. **Access parent dashboard**:
   - After verification, should be able to view child's data
   - Use API: `GET /api/parents/child-data`

### 4. **Parcel Management Workflow**
**Test as Hostel Operations Assistant (`operations@hostelhaven.com`)**

1. **Create parcel**:
   - Use API: `POST /api/parcels/create`
   - Input: `student_admission_number: "ADM001", parcel_name: "Books", sender_name: "Robert Smith"`

2. **Verify parcel token**:
   - Use API: `POST /api/parcels/verify`
   - Input: `token: "<generated-token>"`

### 5. **Mess Feedback Workflow**
**Test as Student (`john.smith@student.edu`)**

1. **Submit feedback**:
   - Use API: `POST /api/feedback`
   - Input: `feedback_type: "mess", rating: 4, feedback_text: "Great food quality!"`

2. **Check sentiment analysis**:
   - Verify `sentiment_label` and `sentiment_score` are populated
   - Should show "positive" sentiment

**Test as Staff (`warden@hostelhaven.com`)**

3. **View feedback statistics**:
   - Use API: `GET /api/feedback/stats`
   - Should show aggregated sentiment data

## 🔍 Database Verification Queries

Run these queries to verify the test data:

```sql
-- Check admission registry
SELECT * FROM admission_registry LIMIT 5;

-- Check user roles
SELECT email, role, status FROM users ORDER BY role, email;

-- Check student profiles
SELECT up.admission_number, up.student_name, up.course, u.email 
FROM user_profiles up 
JOIN users u ON up.user_id = u.id 
WHERE u.role = 'student' 
LIMIT 5;

-- Check parent verification status
SELECT p.email, p.verified, p.otp_code, up.admission_number
FROM parents p
JOIN user_profiles up ON p.student_profile_id = up.id
LIMIT 5;

-- Check room availability
SELECT room_number, room_type, capacity, current_occupancy, status 
FROM rooms 
ORDER BY floor, room_number;

-- Check pending room requests
SELECT r.status, up.admission_number, ro.room_number, r.notes
FROM room_requests r
JOIN user_profiles up ON r.student_profile_id = up.id
JOIN rooms ro ON r.room_id = ro.id
WHERE r.status = 'pending';

-- Check feedback sentiment
SELECT feedback_text, sentiment_label, sentiment_score, rating
FROM feedback 
WHERE feedback_type = 'mess'
ORDER BY created_at DESC
LIMIT 5;
```

## 🎯 Key Testing Points

### Security Features to Test:
1. **No Public Registration**: Try to register as student - should fail
2. **Admission Registry Verification**: Students blocked if not in registry
3. **Parent OTP Verification**: Parents blocked without OTP verification
4. **Capacity Enforcement**: Room requests blocked if room is full
5. **Role-Based Access**: Each role can only access allowed endpoints

### Workflow Validation:
1. **Student Creation**: Only staff can create students
2. **Room Allocation**: Students request, staff approve
3. **Parent Verification**: OTP required before access
4. **Parcel Management**: QR tokens with expiry
5. **Sentiment Analysis**: Automatic feedback analysis

## 🚨 Troubleshooting

### Common Issues:
1. **Authentication Errors**: Check Supabase Auth setup
2. **Permission Denied**: Verify RLS policies are enabled
3. **OTP Not Working**: Check email configuration
4. **Room Allocation Fails**: Verify capacity constraints

### Debug Queries:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Check user permissions
SELECT * FROM users WHERE email = 'your-test-email@example.com';

-- Verify admission registry linkage
SELECT u.email, up.admission_number, up.admission_number_verified
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.role = 'student';
```

## 📱 Frontend Testing

1. **Login as different roles** and verify dashboard access
2. **Test room request flow** in Student Dashboard
3. **Test approval flow** in Warden Dashboard
4. **Test parent verification** flow
5. **Verify navigation** shows correct options per role

This test data provides a complete environment to validate all the security features and workflows implemented in HostelHaven!
