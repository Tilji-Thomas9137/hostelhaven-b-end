# Database Setup Instructions

## Quick Setup

Since you've deleted all tables and want to build from scratch, follow these steps:

### 1. Create the Users Table

Go to your Supabase dashboard → SQL Editor and run this minimal schema:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (essential for authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'hostel_operations_assistant', 'warden', 'parent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Test Authentication

After creating the users table:

1. Start your backend server: `npm run dev`
2. Start your frontend: `npm run dev`
3. Try logging in with Google OAuth
4. The authentication should work now without the "profile setup" error

### 3. Add More Tables Later

Once authentication is working, you can add more tables as needed:

- `hostels` - for hostel information
- `rooms` - for room details
- `payments` - for payment tracking
- `leave_requests` - for leave management
- `complaints` - for complaint system
- `notifications` - for notifications
- `announcements` - for announcements
- `maintenance_requests` - for maintenance tracking

### 4. Current Status

✅ **Fixed Issues:**
- Added `password_hash` field to user creation (set to 'oauth_user' for OAuth users)
- Updated authentication flow to handle missing tables gracefully
- Frontend now shows appropriate messages when tables don't exist
- Backend API properly handles OAuth user profile creation
- Updated role options to match your requirements: student, admin, hostel_operations_assistant, warden, parent

✅ **Authentication Flow:**
- Google OAuth login works without requiring password
- User profiles are created automatically on first login
- Backend API handles profile creation with proper error handling

### 5. Next Steps

1. Run the SQL schema above in Supabase
2. Test the authentication flow
3. Add more tables as needed for your application features
4. The application will gracefully handle missing tables until you add them

## Troubleshooting

If you still get errors:

1. **Check Supabase RLS policies** - Make sure the policies allow users to insert their own profiles
2. **Verify environment variables** - Ensure your backend has the correct Supabase credentials
3. **Check browser console** - Look for any JavaScript errors
4. **Check backend logs** - Look for any server-side errors

The authentication should now work properly for Google OAuth users!
