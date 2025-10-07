# 🚀 Email Service Setup (No Nodemailer)

## 🎯 **Choose Your Email Service**

### **Option 1: Resend (Recommended - Easiest)**
- ✅ **Free**: 3,000 emails/month
- ✅ **Simple setup**
- ✅ **Modern API**
- ✅ **Great for developers**

### **Option 2: SendGrid (Most Popular)**
- ✅ **Free**: 100 emails/day
- ✅ **High deliverability**
- ✅ **Enterprise-grade**
- ✅ **Widely used**

### **Option 3: Mailgun (Reliable)**
- ✅ **Free**: 5,000 emails/month
- ✅ **Good deliverability**
- ✅ **Flexible**

---

## 🚀 **Setup Resend (Recommended)**

### **Step 1: Install Resend**
```bash
cd hostelhaven-b-end
npm install resend
```

### **Step 2: Get Resend API Key**
1. **Go to**: https://resend.com/
2. **Sign up** for free account
3. **Get API key** from dashboard
4. **Add to `config.env`**:
```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM=HostelHaven <noreply@yourdomain.com>
```

### **Step 3: Update Backend**
Replace the mailer import in `routes/admission-registry.js`:
```javascript
// Change this line:
const { sendActivationEmail } = require('../utils/mailer');

// To this:
const { sendActivationEmail } = require('../utils/resend-mailer');
```

### **Step 4: Test**
```bash
node test-email.js
```

---

## 🚀 **Setup SendGrid (Alternative)**

### **Step 1: Install SendGrid**
```bash
cd hostelhaven-b-end
npm install @sendgrid/mail
```

### **Step 2: Get SendGrid API Key**
1. **Go to**: https://sendgrid.com/
2. **Sign up** for free account
3. **Create API key** in Settings → API Keys
4. **Add to `config.env`**:
```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM=noreply@yourdomain.com
```

### **Step 3: Update Backend**
Replace the mailer import in `routes/admission-registry.js`:
```javascript
// Change this line:
const { sendActivationEmail } = require('../utils/mailer');

// To this:
const { sendActivationEmail } = require('../utils/sendgrid-mailer');
```

---

## 🚀 **Setup Mailgun (Alternative)**

### **Step 1: Install Mailgun**
```bash
cd hostelhaven-b-end
npm install mailgun-js
```

### **Step 2: Get Mailgun Credentials**
1. **Go to**: https://www.mailgun.com/
2. **Sign up** for free account
3. **Get API key** and domain
4. **Add to `config.env`**:
```env
# Mailgun Configuration
MAILGUN_API_KEY=your_api_key_here
MAILGUN_DOMAIN=your_domain.mailgun.org
MAILGUN_FROM=noreply@yourdomain.com
```

---

## 🧪 **Test Your Setup**

### **Create Test Script**
```bash
# Test Resend
node -e "
const { sendActivationEmail } = require('./utils/resend-mailer');
sendActivationEmail({
  to: 'test@example.com',
  fullName: 'Test User',
  username: 'TEST123',
  activationLink: 'http://localhost:5173/activate?token=test',
  otpCode: '123456'
}).then(() => console.log('✅ Resend working!')).catch(console.error);
"
```

### **Test SendGrid**
```bash
node -e "
const { sendActivationEmail } = require('./utils/sendgrid-mailer');
sendActivationEmail({
  to: 'test@example.com',
  fullName: 'Test User',
  username: 'TEST123',
  activationLink: 'http://localhost:5173/activate?token=test',
  otpCode: '123456'
}).then(() => console.log('✅ SendGrid working!')).catch(console.error);
"
```

---

## 🔄 **Switch Email Service**

### **To Switch from Nodemailer to Resend:**

1. **Install Resend**:
   ```bash
   npm install resend
   ```

2. **Update `config.env`**:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM=HostelHaven <noreply@yourdomain.com>
   ```

3. **Update `routes/admission-registry.js`**:
   ```javascript
   // Change this line:
   const { sendActivationEmail } = require('../utils/mailer');
   
   // To this:
   const { sendActivationEmail } = require('../utils/resend-mailer');
   ```

4. **Restart server**:
   ```bash
   npm start
   ```

---

## ✅ **Benefits of These Services**

### **vs Nodemailer:**
- ✅ **No SMTP configuration needed**
- ✅ **Better deliverability**
- ✅ **Built-in analytics**
- ✅ **Professional email templates**
- ✅ **No server setup required**
- ✅ **Free tiers available**

### **Recommended Order:**
1. **Resend** (easiest to start)
2. **SendGrid** (most popular)
3. **Mailgun** (most flexible)

**Choose Resend for the easiest setup!**
