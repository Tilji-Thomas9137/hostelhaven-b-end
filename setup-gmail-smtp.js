// Setup Gmail SMTP for sending to any email address
require('dotenv').config();

console.log('📧 Gmail SMTP Setup Guide\n');

console.log('🔧 Step 1: Enable 2-Factor Authentication on Gmail');
console.log('   1. Go to: https://myaccount.google.com/security');
console.log('   2. Click "2-Step Verification"');
console.log('   3. Follow the setup process\n');

console.log('🔑 Step 2: Generate App Password');
console.log('   1. Go to: https://myaccount.google.com/apppasswords');
console.log('   2. Select "Mail" and "Other (Custom name)"');
console.log('   3. Enter: "HostelHaven"');
console.log('   4. Click "Generate"');
console.log('   5. Copy the 16-character password (like: abcd efgh ijkl mnop)\n');

console.log('⚙️ Step 3: Update Environment Variables');
console.log('   Add these to your config.env file:');
console.log('   SMTP_USER=your-email@gmail.com');
console.log('   SMTP_PASS=your-16-character-app-password');
console.log('   SMTP_FROM=HostelHaven <your-email@gmail.com>\n');

console.log('🚀 Step 4: Test Gmail SMTP');
console.log('   Run: node test-gmail-smtp.js\n');

console.log('✅ Gmail SMTP can send to ANY email address!');
console.log('✅ No domain verification needed!');
console.log('✅ Works immediately!');
