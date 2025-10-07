// Quick Gmail SMTP setup for immediate email sending
require('dotenv').config();

console.log('🚀 QUICK GMAIL SMTP SETUP\n');

console.log('📧 This will let you send emails to ANY address immediately!\n');

console.log('🔧 Step 1: Enable 2-Factor Authentication');
console.log('   Go to: https://myaccount.google.com/security');
console.log('   Click "2-Step Verification" and enable it\n');

console.log('🔑 Step 2: Generate App Password');
console.log('   Go to: https://myaccount.google.com/apppasswords');
console.log('   Select "Mail" → "Other (Custom name)"');
console.log('   Enter: "HostelHaven"');
console.log('   Copy the 16-character password\n');

console.log('⚙️ Step 3: Update Your Config');
console.log('   Open: hostelhaven-b-end/config.env');
console.log('   Update these lines:');
console.log('   SMTP_USER=your-email@gmail.com');
console.log('   SMTP_PASS=your-16-character-app-password');
console.log('   SMTP_FROM=HostelHaven <your-email@gmail.com>\n');

console.log('✅ After setup, you can send emails to ANY address!');
console.log('✅ No domain verification needed!');
console.log('✅ Works immediately!');
