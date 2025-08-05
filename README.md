# HostelHaven Backend API

A comprehensive Node.js/Express.js backend API for the HostelHaven student hostel management system, integrated with Supabase for database and authentication.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Complete user profile management with different roles (student, staff, manager, admin)
- **Hostel Management**: Multi-hostel support with detailed information
- **Room Management**: Room allocation, availability tracking, and status management
- **Payment System**: Rent and fee management with payment tracking
- **Leave Management**: Student leave request processing
- **Complaint System**: Issue reporting and resolution tracking
- **Notifications**: Real-time notifications for users
- **Announcements**: Hostel-wide announcements
- **Maintenance Requests**: Maintenance tracking and assignment
- **Security**: Rate limiting, input validation, CORS protection
- **Real-time**: Supabase real-time subscriptions

## 🛠️ Tech Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer
- **Email**: Nodemailer
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
cp config.env .env
```

Update the `.env` file with your Supabase credentials:

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

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. Database Setup

Run the SQL schema in your Supabase SQL editor:

```sql
-- Copy and run the contents of hostelhaven-schema.sql
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Send password reset email
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update current user profile

### Hostels
- `GET /api/hostels` - Get all hostels
- `GET /api/hostels/:id` - Get hostel by ID
- `POST /api/hostels` - Create new hostel (Admin)
- `PUT /api/hostels/:id` - Update hostel (Admin)
- `DELETE /api/hostels/:id` - Delete hostel (Admin)
- `GET /api/hostels/:id/rooms` - Get rooms for hostel
- `GET /api/hostels/:id/statistics` - Get hostel statistics

### Users (Coming Soon)
- `GET /api/users` - Get all users (Admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user (Admin)
- `DELETE /api/users/:id` - Delete user (Admin)

### Rooms (Coming Soon)
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room by ID
- `POST /api/rooms` - Create new room (Admin)
- `PUT /api/rooms/:id` - Update room (Admin)
- `DELETE /api/rooms/:id` - Delete room (Admin)

### Payments (Coming Soon)
- `GET /api/payments` - Get user payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id` - Update payment status

### Leave Requests (Coming Soon)
- `GET /api/leaves` - Get leave requests
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id` - Update leave status

### Complaints (Coming Soon)
- `GET /api/complaints` - Get complaints
- `POST /api/complaints` - Create complaint
- `PUT /api/complaints/:id` - Update complaint status

### Notifications (Coming Soon)
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id` - Mark notification as read

### Announcements (Coming Soon)
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement (Admin)

### Maintenance (Coming Soon)
- `GET /api/maintenance` - Get maintenance requests
- `POST /api/maintenance` - Create maintenance request
- `PUT /api/maintenance/:id` - Update maintenance status

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **student**: Basic user access
- **staff**: Staff member access
- **manager**: Manager access
- **admin**: Full administrative access

## 🛡️ Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: All inputs are validated using express-validator
- **CORS Protection**: Configured for specific origins
- **Helmet**: Security headers
- **SQL Injection Protection**: Supabase handles this automatically
- **XSS Protection**: Input sanitization and output encoding

## 📊 Database Schema

The database includes the following main tables:

- **users**: User profiles and authentication
- **hostels**: Hostel information
- **rooms**: Room details and availability
- **payments**: Payment tracking
- **leave_requests**: Student leave management
- **complaints**: Issue tracking
- **notifications**: User notifications
- **announcements**: Hostel announcements
- **maintenance_requests**: Maintenance tracking

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
backend/
├── config/
│   └── supabase.js          # Supabase configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── hostels.js           # Hostel management routes
│   ├── users.js             # User management routes
│   ├── rooms.js             # Room management routes
│   ├── payments.js          # Payment routes
│   ├── leaves.js            # Leave request routes
│   ├── complaints.js        # Complaint routes
│   ├── notifications.js     # Notification routes
│   ├── announcements.js     # Announcement routes
│   └── maintenance.js       # Maintenance routes
├── server.js                # Main server file
├── package.json             # Dependencies and scripts
├── config.env               # Environment variables
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

---

**HostelHaven Backend API** - Built with ❤️ for better hostel management 