# HostelHaven Test User Credentials Setup

## 🔐 **Important Note About Authentication**

The test data script creates user records in our application database, but **passwords are managed by Supabase Auth**, not our database. You need to set up the authentication credentials separately.

## 🚀 **Setup Methods**

### **Method 1: Supabase Dashboard (Recommended)**

1. **Go to Supabase Dashboard** → Your Project → Authentication → Users
2. **Create users manually** using the email addresses from test data
3. **Set temporary passwords** for initial login
4. **Users will be prompted to change passwords** on first login

### **Method 2: Supabase Admin API**

Use the Supabase Admin API to create auth users programmatically.

### **Method 3: Application Registration Flow**

Use the existing registration endpoints (though they're now restricted).

## 📋 **Test User Credentials to Set Up**

### **Staff Users**

| **Role** | **Email** | **Suggested Password** | **Full Name** |
|----------|-----------|----------------------|---------------|
| Admin | `admin@hostelhaven.com` | `Admin123!` | Dr. Admin Manager |
| Warden | `warden@hostelhaven.com` | `Warden123!` | Ms. Warden Supervisor |
| Hostel Operations | `operations@hostelhaven.com` | `Ops123!` | Mr. Operations Manager |

### **Student Users**

| **Email** | **Suggested Password** | **Full Name** | **Admission Number** |
|-----------|----------------------|---------------|---------------------|
| `john.smith@student.edu` | `Student123!` | John Smith | ADM001 |
| `sarah.johnson@student.edu` | `Student123!` | Sarah Johnson | ADM002 |
| `david.wilson@student.edu` | `Student123!` | David Wilson | ADM003 |
| `emily.brown@student.edu` | `Student123!` | Emily Brown | ADM004 |
| `michael.davis@student.edu` | `Student123!` | Michael Davis | ADM005 |
| `jessica.miller@student.edu` | `Student123!` | Jessica Miller | ADM006 |
| `christopher.garcia@student.edu` | `Student123!` | Christopher Garcia | ADM007 |
| `amanda.rodriguez@student.edu` | `Student123!` | Amanda Rodriguez | ADM008 |
| `matthew.martinez@student.edu` | `Student123!` | Matthew Martinez | ADM009 |
| `ashley.anderson@student.edu` | `Student123!` | Ashley Anderson | ADM010 |

### **Parent Users**

| **Email** | **Suggested Password** | **Full Name** | **Child's Admission** |
|-----------|----------------------|---------------|---------------------|
| `robert.smith@email.com` | `Parent123!` | Robert Smith | ADM001 |
| `michael.johnson@email.com` | `Parent123!` | Michael Johnson | ADM002 |
| `linda.wilson@email.com` | `Parent123!` | Linda Wilson | ADM003 |
| `james.brown@email.com` | `Parent123!` | James Brown | ADM004 |
| `patricia.davis@email.com` | `Parent123!` | Patricia Davis | ADM005 |

## 🛠️ **Detailed Setup Instructions**

### **Step 1: Supabase Dashboard Setup**

1. **Navigate to Supabase Dashboard**
   - Go to your project → Authentication → Users
   - Click "Add User" or "Invite User"

2. **Create Staff Users First**
   ```
   Email: admin@hostelhaven.com
   Password: Admin123!
   Email Confirm: ✅ (check this box)
   ```

3. **Create Student Users**
   ```
   Email: john.smith@student.edu
   Password: Student123!
   Email Confirm: ✅ (check this box)
   ```

4. **Create Parent Users**
   ```
   Email: robert.smith@email.com
   Password: Parent123!
   Email Confirm: ✅ (check this box)
   ```

### **Step 2: Verify Database Linking**

After creating auth users, verify they're properly linked:

```sql
-- Check if auth users are linked to our database users
SELECT 
    u.email, 
    u.role, 
    u.status,
    u.auth_uid,
    CASE WHEN u.auth_uid IS NOT NULL THEN 'Linked' ELSE 'Not Linked' END as auth_status
FROM users u 
ORDER BY u.role, u.email;
```

### **Step 3: Update Auth UIDs (If Needed)**

If the auth_uid doesn't match, update it:

```sql
-- Example: Update auth_uid for admin user
UPDATE users 
SET auth_uid = 'actual-auth-uid-from-supabase' 
WHERE email = 'admin@hostelhaven.com';
```

## 🔧 **Automated Setup Script**

I can create a script to help you set up the auth users programmatically. Would you like me to create:

1. **A Node.js script** to create auth users via Supabase Admin API
2. **A SQL script** to update auth_uid references
3. **A batch script** for easier setup

## 🧪 **Testing Login**

Once credentials are set up, test login:

### **Frontend Testing**
1. Go to your login page
2. Try logging in with any of the test credentials
3. Verify role-based redirects work correctly

### **API Testing**
```bash
# Test login API
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hostelhaven.com",
    "password": "Admin123!"
  }'
```

## 🔒 **Security Notes**

### **Password Requirements**
- Minimum 6 characters
- Must contain uppercase, lowercase, and number
- These are test passwords - change in production!

### **Email Verification**
- For test users, you can mark emails as confirmed in Supabase
- In production, users should verify their own emails

### **Role Verification**
After login, verify the user has the correct role:
```sql
SELECT email, role, status FROM users WHERE email = 'admin@hostelhaven.com';
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"User not found"**
   - Check if auth user exists in Supabase Auth
   - Verify email spelling

2. **"Invalid password"**
   - Reset password in Supabase Dashboard
   - Check password requirements

3. **"Account not activated"**
   - Check if user exists in our database
   - Verify admission registry linkage for students
   - Check parent verification status

4. **"Permission denied"**
   - Verify RLS policies are working
   - Check user role and permissions

### **Debug Queries**

```sql
-- Check user status
SELECT email, role, status, auth_uid FROM users WHERE email = 'test@example.com';

-- Check student verification
SELECT u.email, up.admission_number_verified, up.parent_contact_locked 
FROM users u 
JOIN user_profiles up ON u.id = up.user_id 
WHERE u.role = 'student';

-- Check parent verification
SELECT p.email, p.verified, p.otp_code 
FROM parents p 
WHERE p.email = 'parent@example.com';
```

## 📝 **Quick Setup Checklist**

- [ ] Create auth users in Supabase Dashboard
- [ ] Set passwords for all test users
- [ ] Verify email confirmation status
- [ ] Check auth_uid linking in database
- [ ] Test login for each role
- [ ] Verify role-based access works
- [ ] Test parent OTP verification flow
- [ ] Verify student admission registry linkage

Would you like me to create an automated script to set up these credentials, or do you prefer to set them up manually through the Supabase Dashboard?
