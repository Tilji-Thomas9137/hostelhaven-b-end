# HostelHaven Smart Hostel Management System

A comprehensive hostel management system with secure authentication, role-based access control, and streamlined workflows for students, parents, and staff.

## 🚀 Key Features

### 🔐 **Secure Authentication System**
- **No Public Registration**: Students and parents cannot self-register
- **Staff-Only Account Creation**: Admin/Warden creates student accounts from admission registry
- **Parent OTP Verification**: Parents receive OTP via email for first-time login
- **Role-Based Access Control**: Admin, Warden, Operations Assistant, Student, Parent roles

### 👥 **User Roles & Permissions**

#### **Admin**
- Full system control and management
- Create/manage staff accounts (Warden, Operations Assistant)
- Manage admission registry
- Activate student accounts
- View all reports and analytics

#### **Warden**
- Approve/reject room requests
- Approve/reject leave requests
- Manage room allocations
- View feedback reports and sentiment analysis
- Handle parent verification

#### **Hostel Operations Assistant**
- Manage cleaning schedules
- Handle parcel management (QR system)
- Process room requests
- View operations dashboard

#### **Student**
- Submit room requests
- Submit leave requests
- File complaints
- Submit mess feedback
- Submit cleaning requests

#### **Parent**
- View child's room allocation
- View child's leave history
- View payment status
- Receive announcements
- Track parcels for child

### 🏠 **Room Management System**

#### **Room Types**
- **Single**: 1 student capacity
- **Double**: 2 student capacity  
- **Triple**: 3 student capacity

#### **Room Request Flow**
1. Student submits room request with preferences
2. Staff (Warden/Assistant) reviews request
3. Staff approves and allocates room OR rejects with reason
4. System prevents double booking with atomic transactions
5. Room occupancy automatically updated

#### **Room Allocation Logic**
- Prevents overbooking (current_occupancy < capacity)
- Atomic transactions ensure data consistency
- Automatic status updates (available/partially_filled/full)
- Real-time occupancy tracking

### 👨‍👩‍👧‍👦 **Parent System**

#### **Parent Account Creation**
- Parent accounts auto-created from admission registry
- No manual registration required
- Linked to child via admission_number

#### **Parent Verification Process**
1. Parent enters email address
2. System sends 6-digit OTP to email
3. Parent enters OTP for verification
4. Once verified, parent can access child's information
5. OTP expires in 10 minutes, max 3 attempts

#### **Parent Access**
- View child's room allocation details
- View child's leave request history
- View payment status and history
- Receive hostel announcements
- Track parcels addressed to child

### 📦 **Parcel Management (QR System)**

#### **QR Workflow**
1. Staff logs parcel arrival → generates QR token (HMAC + expiry)
2. Student shows QR → staff verifies via API
3. System marks parcel as claimed
4. Prevents duplicate claims

#### **Security Features**
- HMAC-SHA256 signed tokens
- Time-based expiry
- One-time use tokens
- Identity verification

### 🧹 **Cleaning Schedule Management**

#### **Cleaning Request Flow**
1. Student submits cleaning request
2. Request automatically tied to student's allocated room
3. Operations Assistant manages and assigns cleaning staff
4. Status tracking (pending/assigned/in-progress/completed)

### 📊 **Feedback & Sentiment Analysis**

#### **Mess Feedback System**
1. Students submit mess feedback
2. Backend calls Python microservice for sentiment analysis
3. Uses VADER/TextBlob for sentiment scoring
4. Stores sentiment score + label in database
5. Warden/Assistant dashboard shows aggregated analytics

### 🔒 **Security & Access Control**

#### **Database Security**
- Row Level Security (RLS) policies
- Supabase Auth integration
- Secure API endpoints with JWT validation
- Input validation and sanitization

#### **API Security**
- Role-based middleware
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation with express-validator

## 🛠️ **Technical Architecture**

### **Backend (Node.js + Express)**
- RESTful API with proper HTTP status codes
- Middleware-based authentication and authorization
- Transaction-safe database operations
- Comprehensive error handling
- Real-time updates via Supabase subscriptions

### **Frontend (React + Vite)**
- Role-based dashboard routing
- Responsive design with Tailwind CSS
- Real-time UI updates
- Form validation and error handling
- Context-based state management

### **Database (Supabase PostgreSQL)**
- Optimized schema with proper relationships
- Row Level Security policies
- Real-time subscriptions
- Backup and recovery

## 📋 **System Workflows**

### **Student Onboarding**
1. Admin adds student to admission registry with parent details
2. Admin activates student account (creates auth user)
3. Student can login and submit room request
4. Staff processes room request and allocates room

### **Parent Onboarding**
1. Parent account auto-created when student added to registry
2. Parent receives email with verification instructions
3. Parent completes OTP verification
4. Parent can access child's information

### **Room Allocation Process**
1. Student submits room request with preferences
2. Staff reviews and approves/rejects
3. On approval, system checks room availability
4. If available, creates allocation and updates occupancy
5. Student receives notification of allocation

### **Leave Request Process**
1. Student submits leave request with dates and reason
2. Warden/Assistant reviews request
3. Staff approves/rejects with notes
4. Parent can view leave history

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js (v16+)
- Supabase account and project
- Environment variables configured

### **Installation**
```bash
# Backend
cd hostelhaven-b-end
npm install
npm start

# Frontend  
cd hostelhaven-f-end
npm install
npm run dev
```

### **Environment Setup**
Copy `config.env.example` to `config.env` and configure:
- Supabase URL and API keys
- JWT secrets
- Email service credentials
- AI service endpoints

## 📚 **API Endpoints**

### **Authentication**
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/me` - Update user profile

### **Staff Management**
- `GET /api/staff-management/staff` - Get all staff
- `POST /api/staff-management/staff` - Create staff member
- `PUT /api/staff-management/staff/:id` - Update staff member
- `DELETE /api/staff-management/staff/:id` - Deactivate staff member

### **Admission Registry**
- `GET /api/admission-registry/students` - Get all students
- `POST /api/admission-registry/students` - Add student to registry
- `POST /api/admission-registry/students/:id/activate` - Activate student

### **Room Management**
- `GET /api/room-management/rooms` - Get all rooms
- `GET /api/room-management/available-rooms` - Get available rooms
- `POST /api/room-management/allocate` - Allocate room to student
- `POST /api/room-management/deallocate` - Deallocate room

### **Room Requests**
- `POST /api/room-requests` - Submit room request (student)
- `GET /api/room-requests/my-requests` - Get student's requests
- `PUT /api/room-requests/:id/approve` - Approve request (staff)
- `PUT /api/room-requests/:id/reject` - Reject request (staff)

### **Parent Verification**
- `POST /api/parent-verification/send-otp` - Send OTP to parent
- `POST /api/parent-verification/verify-otp` - Verify OTP
- `GET /api/parent-verification/child-info` - Get child information
- `GET /api/parent-verification/child-leave-history` - Get leave history

## 🔧 **Database Schema**

### **Key Tables**
- `users` - User profiles and authentication
- `admission_registry` - Student admission records
- `parents` - Parent information and verification status
- `rooms` - Room details and occupancy
- `room_allocations` - Student room assignments
- `room_requests` - Student room requests
- `leave_requests` - Student leave applications
- `complaints` - Student complaints
- `payments` - Payment records
- `parcels` - Parcel management with QR tokens
- `feedback` - Mess feedback with sentiment scores
- `notifications` - System notifications

## 🚨 **Important Notes**

### **No Public Registration**
- Students and parents cannot self-register
- All accounts created by staff through proper channels
- This ensures data integrity and security

### **Transaction Safety**
- All room allocations use atomic transactions
- Prevents double booking and data inconsistency
- Automatic rollback on failures

### **Security First**
- All API endpoints protected with authentication
- Role-based access control enforced
- Input validation and sanitization
- Rate limiting and CORS protection

## 📞 **Support**

For technical support or questions about the system, please contact the development team or refer to the API documentation.

---

**HostelHaven** - Smart Hostel Management Made Simple 🏠✨
