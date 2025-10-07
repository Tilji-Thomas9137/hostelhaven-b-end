// Test Gmail SMTP email sending
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testGmailSMTP() {
  console.log('📧 Testing Gmail SMTP Email Sending...\n');
  
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
    console.log('\n🔧 Make sure you have:');
    console.log('1. ✅ Enabled 2-Factor Authentication on Gmail');
    console.log('2. ✅ Generated App Password (16 characters)');
    console.log('3. ✅ Updated SMTP_PASS in config.env');
  }
}

testGmailSMTP();
