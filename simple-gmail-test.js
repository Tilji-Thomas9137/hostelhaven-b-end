// Simple Gmail SMTP test using built-in modules
const https = require('https');

async function testGmailSMTP() {
  console.log('📧 Gmail SMTP Setup Instructions\n');
  
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
  console.log('   Replace "your_16_character_app_password_here" with your actual app password');
  console.log('   Save the file\n');
  
  console.log('🚀 Step 4: Install Nodemailer');
  console.log('   Run: npm install nodemailer\n');
  
  console.log('✅ After completing these steps:');
  console.log('   • You can send emails to ANY email address');
  console.log('   • No domain verification needed');
  console.log('   • Professional emails from your Gmail account');
  console.log('   • Works immediately!');
  
  console.log('\n🎯 Your current config is ready:');
  console.log('   SMTP_USER=tilutilji@gmail.com');
  console.log('   SMTP_PASS=your_16_character_app_password_here');
  console.log('   SMTP_FROM=HostelHaven <tilutilji@gmail.com>');
}

testGmailSMTP();
