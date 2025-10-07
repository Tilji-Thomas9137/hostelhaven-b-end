# 🚀 Quick Setup Guide: Email & WhatsApp Notifications

## ❌ **Current Issue**
Students are being created but **emails and WhatsApp notifications are not being sent** because the email/WhatsApp configuration is not properly set up.

## 🔧 **IMMEDIATE FIX**

### **Step 1: Test Current Configuration**
```bash
cd hostelhaven-b-end
node test-email.js
```

This will show you exactly what's missing in your configuration.

### **Step 2: Configure Email (Gmail - Recommended)**

#### **For Gmail:**
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Generate new app password for "Mail"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

3. **Update `config.env`**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_actual_email@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

#### **For Other Email Providers:**

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

**Yahoo Mail:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your_email@yahoo.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

### **Step 3: Configure WhatsApp (Optional)**

#### **For WhatsApp Business API:**
1. **Create Meta Developer Account**
2. **Set up WhatsApp Business API**
3. **Get your credentials**

4. **Update `config.env`**:
```env
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_TEMPLATE_NAME=hostelhaven_activation
WHATSAPP_TEMPLATE_LANG=en
```

### **Step 4: Test the Configuration**
```bash
# Test email functionality
node test-email.js

# Or run the setup script
setup-email.bat
```

### **Step 5: Restart the Server**
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm start
```

## 🧪 **Testing**

### **Test Email Sending:**
1. **Add a new student** through the admin dashboard
2. **Check the server console** for email sending logs:
   - ✅ `Student activation email sent successfully to student@email.com`
   - ✅ `Parent activation email sent successfully to parent@email.com`
   - ✅ `WhatsApp notification sent successfully to +1234567890`

3. **Check email inboxes** (including spam folder)

### **If Emails Still Don't Work:**

#### **Check Server Logs:**
Look for these error messages in your server console:
- ❌ `Failed to send student activation email:`
- ❌ `Failed to send parent activation email:`
- ❌ `Failed to send WhatsApp notification:`

#### **Common Issues & Solutions:**

1. **"Invalid login" error:**
   - ✅ Use App Password, not regular password
   - ✅ Enable 2-Factor Authentication

2. **"Connection refused" error:**
   - ✅ Check SMTP_HOST and SMTP_PORT
   - ✅ Try different port (465 or 587)

3. **"Authentication failed" error:**
   - ✅ Double-check SMTP_USER and SMTP_PASS
   - ✅ Make sure 2FA is enabled

4. **Emails go to spam:**
   - ✅ Check spam folder
   - ✅ Add SMTP_FROM to trusted senders

## 📧 **What Students & Parents Receive**

### **Student Email Contains:**
- ✅ Username (admission number)
- ✅ OTP code (valid 10 minutes)
- ✅ Activation link (valid 24 hours)
- ✅ Professional HTML template

### **Parent Email Contains:**
- ✅ Parent username
- ✅ OTP code (valid 10 minutes)
- ✅ Activation link (valid 24 hours)
- ✅ Professional HTML template

### **WhatsApp Notification Contains:**
- ✅ Username and OTP
- ✅ Activation link
- ✅ Validity information

## 🚨 **Quick Troubleshooting**

### **Run These Commands:**
```bash
# 1. Test email configuration
node test-email.js

# 2. Check server logs when adding student
# Look for ✅ or ❌ messages

# 3. Verify environment variables
echo %SMTP_USER%
echo %SMTP_PASS%
```

### **If Nothing Works:**
1. **Use a different email provider** (Outlook, Yahoo)
2. **Check firewall/antivirus** blocking SMTP
3. **Try different SMTP ports** (465, 587, 25)
4. **Contact your email provider** for SMTP settings

## ✅ **Success Indicators**

When working correctly, you'll see:
- ✅ Server logs showing successful email sending
- ✅ Students receive activation emails
- ✅ Parents receive activation emails
- ✅ WhatsApp notifications sent (if configured)
- ✅ Professional email templates with OTP codes

**The system is now ready to automatically send credentials when you add students!**
