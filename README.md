# HostelHaven Backend API

A comprehensive Node.js/Express.js backend API for the HostelHaven student hostel management system, integrated with Supabase for database and authentication. This system implements secure, production-ready flows for admissions, parent verification, room allocation, and parcel management.

## 🚀 Features

- **Secure Authentication & Authorization**: JWT-based authentication with role-based access control and RLS policies
- **Staff-Only Registration**: No public student self-registration; staff creates and activates student accounts
- **Parent Verification**: Parent accounts created by staff with OTP/email verification
- **Single Hostel Management**: Simplified architecture for single hostel operations
- **Capacity-Aware Room Management**: Strict room allocation preventing overbooking with atomic operations
- **Room Request System**: Students can request rooms, staff approve/reject with transaction safety
- **Parcel Management**: QR workflow with signed/expiring tokens and identity verification
- **Mess Feedback**: AI-powered sentiment analysis (VADER/TextBlob) with staff dashboard
- **Role-Based Dashboards**: Distinct permissions for Warden, Hostel Operations Assistant, and Admin
- **Real-time Updates**: Supabase real-time subscriptions for live data
- **Comprehensive Security**: RLS policies, input validation, rate limiting, CORS protection

## 🛠️ Tech Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting, HMAC-SHA256 for parcel tokens
- **File Upload**: Multer
- **Email**: Nodemailer with SMTP
- **AI Service**: Flask + NLTK (VADER sentiment analysis)
- **Logging**: Morgan

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project
- Environment variables configured

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment configuration:

```bash
cp config.env.example .env
```

Update the `.env` file with your credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# Email Configuration (Required for parent OTP verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=HostelHaven <noreply@hostelhaven.com>

# Parcel Token Security
PARCEL_HMAC_SECRET=your-secure-hmac-secret-key

# AI Service Configuration
AI_SERVICE_URL=http://localhost:5001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. Database Setup

Run the migration scripts in your Supabase SQL editor in order:

1. **Main Schema Migration**:
```sql
-- Copy and run the contents of sql/2025-01-15-fix-hostelhaven-schema.sql
```

2. **RLS Policies**:
```sql
-- Copy and run the contents of sql/policies_fix.sql
```

3. **Create Admin User**:
```sql
-- Follow instructions in sql/README.md to create admin user and update auth_uid
```

### 4. Start AI Microservice (Optional)

For sentiment analysis features, start the AI service:

```bash
cd ai-service
pip install -r requirements.txt
python app.py
```

The AI service will start on `http://localhost:5001`

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Send password reset email
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/google` - Initiate Google OAuth login

### Hostel Operations Assistant Management
- `POST /api/hostel_assistant/create-student` - Create student account (Hostel Operations Assistant only)
- `GET /api/hostel_assistant/admission-registry` - Get admission registry entries
- `POST /api/hostel_assistant/admission-registry` - Add admission registry entry
- `GET /api/hostel_assistant/pending-requests` - Get pending room requests
- `GET /api/hostel_assistant/pending-data-review` - Get data needing manual review

### Parent Verification
- `POST /api/parents/send-otp` - Send OTP to parent email
- `POST /api/parents/verify-otp` - Verify OTP and activate parent account

### Room Management
- `GET /api/rooms/available` - Get available rooms (capacity-aware)
- `POST /api/rooms/request` - Submit room request (Student)
- `GET /api/rooms/requests` - Get user's room requests (Student)
- `GET /api/rooms/pending-requests` - Get pending room requests (Staff)
- `POST /api/rooms/approve` - Approve/reject room request (Staff)
- `GET /api/rooms/my-room` - Get current room details
- `GET /api/rooms/history` - Get room allocation history

### Parcel Management
- `POST /api/parcels/create` - Create parcel entry with QR token (Staff)
- `POST /api/parcels/verify` - Verify parcel token and release (Staff)

### Mess Feedback
- `POST /api/feedback` - Submit mess feedback with sentiment analysis
- `GET /api/feedback/stats` - Get feedback statistics (Staff)

### System Management
- `GET /api/system/info` - Get system information (Admin)
- `PUT /api/system/settings` - Update system settings (Admin)

### Payments
- `GET /api/payments` - Get user payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id` - Update payment status

### Leave Requests
- `GET /api/leaves` - Get leave requests
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id` - Update leave status

### Complaints
- `GET /api/complaints` - Get complaints
- `POST /api/complaints` - Create complaint
- `PUT /api/complaints/:id` - Update complaint status

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id` - Mark notification as read

### Announcements
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement (Admin)

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **student**: Basic user access, can request rooms and view own data
- **parent**: Can view linked child's data after OTP verification
- **hostel_operations_assistant**: Staff member, can manage room requests and allocations
- **warden**: Staff member, can manage students and view reports
- **admin**: Full administrative access, can create staff accounts and manage system

## 🛡️ Security Features

- **Row Level Security (RLS)**: Database-level access control based on user roles
- **Staff-Only Registration**: No public student self-registration; students must be created by staff
- **Admission Registry Verification**: Students must be linked to admission_registry before activation
- **Parent OTP Verification**: Secure parent account activation via email OTP
- **Capacity-Aware Allocation**: Atomic room allocation preventing overbooking with transaction safety
- **HMAC Token Security**: Signed/expiring tokens for parcel management with identity verification
- **Role-Based Access Control**: Strict role checks (admin, warden, hostel_operations_assistant, student, parent)
- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: All inputs are validated using express-validator
- **CORS Protection**: Configured for specific origins
- **Helmet**: Security headers
- **SQL Injection Protection**: Supabase handles this automatically
- **XSS Protection**: Input sanitization and output encoding

## 📊 Database Schema

The database includes the following main tables:

### Core Tables
- **users**: User profiles and authentication with role-based access
- **admission_registry**: Authoritative student admission data (staff-only editable)
- **parents**: Parent accounts with OTP verification status
- **rooms**: Room details with capacity tracking and availability

### Room Management
- **room_requests**: Student room requests (pending/approved/rejected)
- **room_allocations**: Confirmed room assignments with transaction safety
- **room_waitlist**: Students waiting for room availability
- **allocation_batches**: Batch allocation management

### Operations
- **payments**: Payment tracking with RLS policies
- **leave_requests**: Student leave management
- **complaints**: Issue tracking and resolution
- **notifications**: User notifications
- **announcements**: Hostel announcements
- **maintenance_requests**: Maintenance tracking
- **parcels**: Parcel management with QR tokens
- **mess_feedback**: Mess feedback with sentiment analysis

## 🔧 Development

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint issues
```

### Project Structure

```
hostelhaven-b-end/
├── config/
│   ├── supabase.js          # Supabase configuration
│   ├── server.js            # Server configuration
│   ├── routes.js            # Routes configuration
│   └── middleware.js        # Middleware configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── authorize.js         # Role-based authorization
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── staff.js             # Staff management routes
│   ├── parents.js           # Parent verification routes
│   ├── rooms.js             # Room management routes
│   ├── parcels.js           # Parcel management routes
│   ├── feedback.js          # Mess feedback routes
│   ├── hostels.js           # Hostel management routes
│   ├── payments.js          # Payment routes
│   ├── leave-requests.js    # Leave request routes
│   ├── complaints.js        # Complaint routes
│   ├── notifications.js     # Notification routes
│   └── announcements.js     # Announcement routes
├── sql/
│   ├── 2025-01-15-fix-hostelhaven-schema.sql  # Main migration
│   ├── policies_fix.sql     # RLS policies
│   └── README.md            # Database setup instructions
├── ai-service/
│   ├── app.py               # Flask AI microservice
│   └── requirements.txt     # Python dependencies
├── server.js                # Main server file
├── package.json             # Dependencies and scripts
├── config.env.example       # Environment variables template
└── README.md                # This file
```

## 🌐 API Documentation

### Request/Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=your-production-supabase-url
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
JWT_SECRET=your-production-jwt-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

### Deployment Platforms

- **Heroku**: Easy deployment with Git integration
- **Vercel**: Serverless deployment
- **Railway**: Simple container deployment
- **DigitalOcean**: App Platform or Droplets
- **AWS**: EC2 or Lambda

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the API documentation
- Review the Supabase documentation

## 🔄 Updates

Stay updated with the latest changes:

- Follow the repository for updates
- Check the changelog
- Review release notes

## 📋 CHANGELOG

### v2.0.0 - Major Security & Feature Update (2025-01-15)

#### 🔒 Security Enhancements
- **Staff-Only Registration**: Removed public student self-registration
- **Parent OTP Verification**: Implemented secure parent account activation
- **Row Level Security (RLS)**: Added comprehensive database-level access control
- **HMAC Token Security**: Secure parcel management with signed/expiring tokens
- **Capacity-Aware Allocation**: Atomic room allocation preventing overbooking

#### 🏠 Room Management Overhaul
- **New Tables**: `admission_registry`, `parents`, `room_requests`, `room_allocations`, `room_waitlist`, `allocation_batches`
- **Capacity Tracking**: Real-time room occupancy with strict capacity limits
- **Request System**: Students can request rooms, staff approve/reject with transaction safety
- **Batch Allocation**: Admin can run automated room allocation processes

#### 👥 User Management
- **Role-Based Access**: Enhanced permissions for student, parent, hostel_operations_assistant, warden, admin
- **Parent Accounts**: Automatic creation with OTP verification workflow
- **Staff Creation**: Admin creates staff accounts, staff creates student accounts

#### 📦 New Features
- **Parcel Management**: QR code workflow with identity verification
- **Mess Feedback**: AI-powered sentiment analysis using VADER/TextBlob
- **AI Microservice**: Flask-based sentiment analysis service
- **Enhanced Dashboards**: Role-specific UI components and permissions

#### 🛠️ Technical Improvements
- **Database Migrations**: Idempotent SQL scripts with safe backfill
- **Error Handling**: Enhanced error classes and async middleware
- **API Documentation**: Updated endpoints with role requirements
- **Environment Configuration**: New variables for email, AI service, parcel security

#### 📁 File Structure Changes
- **New Routes**: `staff.js`, `parents.js`, `parcels.js`, `feedback.js`
- **New Middleware**: `authorize.js` for role-based authorization
- **New SQL**: Migration scripts and RLS policies
- **New Service**: AI microservice with Flask + NLTK

#### 🔄 Migration Notes
- Run `sql/2025-01-15-fix-hostelhaven-schema.sql` first
- Apply `sql/policies_fix.sql` for RLS policies
- Follow `sql/README.md` for admin user setup
- Update environment variables with new configuration

---

**HostelHaven Backend API** - Built with ❤️ for better hostel management 