// Complete SMTP test for Gmail
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testSMTPComplete() {
  console.log('📧 Complete SMTP Test for Gmail\n');
  
  // Check if Gmail credentials are set
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpUser || smtpPass === 'your_16_character_app_password_here') {
    console.log('❌ Gmail SMTP not configured yet!\n');
    console.log('🔧 Please complete these steps first:\n');
    console.log('1. Enable 2-Factor Authentication on Gmail:');
    console.log('   https://myaccount.google.com/security\n');
    console.log('2. Generate App Password:');
    console.log('   https://myaccount.google.com/apppasswords');
    console.log('   Select "Mail" → "Other (Custom name)"');
    console.log('   Enter: "HostelHaven"');
    console.log('   Copy the 16-character password\n');
    console.log('3. Update config.env:');
    console.log('   Replace "your_16_character_app_password_here" with your actual app password\n');
    return;
  }
  
  console.log('✅ Gmail SMTP credentials found!');
  console.log(`📧 SMTP User: ${smtpUser}`);
  console.log(`🔑 SMTP Pass: ${smtpPass.substring(0, 4)}****\n`);
  
  // Test with your email first
  const testEmail = 'tilutilji@gmail.com';
  
  try {
    console.log(`📤 Sending test email to: ${testEmail}`);
    
    const result = await sendActivationEmailGmail({
      to: testEmail,
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    });
    
    console.log(`✅ Gmail SMTP email sent successfully!`);
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log('\n📬 Check your inbox at tilutilji@gmail.com');
    console.log('🎉 Gmail SMTP is working! You can now send to ANY email address!');
    
  } catch (error) {
    console.error('❌ Gmail SMTP failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if 2-Factor Authentication is enabled');
    console.log('2. Verify the App Password is correct');
    console.log('3. Make sure SMTP_PASS is updated in config.env');
  }
}

testSMTPComplete();
