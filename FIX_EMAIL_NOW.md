# 🚨 URGENT: Fix Email Configuration

## ❌ **Current Error:**
```
Invalid login: 535-5.7.8 Username and Password not accepted
SMTP_USER: your_email@gmail.com (WRONG!)
```

## ✅ **IMMEDIATE FIX STEPS:**

### **Step 1: Get Gmail App Password**

1. **Go to your Gmail account**: https://myaccount.google.com/
2. **Click "Security"** in the left sidebar
3. **Enable 2-Step Verification** (if not already enabled)
4. **Click "App passwords"** under 2-Step Verification
5. **Select "Mail"** and generate password
6. **Copy the 16-character password** (like: `abcd efgh ijkl mnop`)

### **Step 2: Update config.env**

**Open `hostelhaven-b-end/config.env` and change:**

```env
# CHANGE THIS LINE:
SMTP_USER=your_email@gmail.com

# TO THIS (use your actual Gmail):
SMTP_USER=aswinkavumkal2002@gmail.com

# CHANGE THIS LINE:
SMTP_PASS=your_app_password

# TO THIS (use the 16-character app password from Step 1):
SMTP_PASS=abcd efgh ijkl mnop
```

### **Step 3: Test the Fix**

```bash
cd hostelhaven-b-end
node test-email.js
```

**You should see:**
- ✅ `Email sent successfully!`
- ✅ No more "Invalid login" errors

### **Step 4: Restart Server**

```bash
# Stop current server (Ctrl+C)
npm start
```

### **Step 5: Test with Real Student**

1. **Add a new student** through admin dashboard
2. **Check server console** for:
   - ✅ `Student activation email sent successfully`
   - ✅ `Parent activation email sent successfully`
3. **Check email inboxes** (including spam folder)

## 🔧 **Alternative: Use Different Email Provider**

If Gmail doesn't work, try **Outlook**:

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_outlook_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

## 📱 **WhatsApp is Already Working!**

Your WhatsApp is working in development mode. To make it send real messages:

1. **Get WhatsApp Business API credentials**
2. **Add to config.env**:
```env
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

## ✅ **Success Indicators**

When fixed, you'll see:
- ✅ `Student activation email sent successfully to student@email.com`
- ✅ `Parent activation email sent successfully to parent@email.com`
- ✅ Professional HTML emails with OTP codes
- ✅ Activation links for account setup

## 🚨 **If Still Not Working**

1. **Check Gmail security settings**
2. **Try different SMTP port** (465 instead of 587)
3. **Use a different email provider**
4. **Check firewall/antivirus** blocking SMTP

**The main issue is the Gmail App Password - get that and update config.env!**
