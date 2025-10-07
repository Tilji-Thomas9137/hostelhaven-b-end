// Test sending to external email address
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testExternalEmail() {
  console.log('📧 Testing Email to External Address...\n');
  
  // Test with a different email address
  const testEmail = 'test@example.com';  // Change this to a real email you have access to
  
  try {
    console.log(`📤 Sending test email to: ${testEmail}`);
    
    const result = await sendActivationEmailGmail({
      to: testEmail,
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    });
    
    console.log(`✅ Email sent successfully! Message ID: ${result.messageId}`);
    console.log('\n📬 Check the email account you specified');
    console.log('🎉 If you receive it there, the system is working!');
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
  }
  
  console.log('\n🔧 TROUBLESHOOTING:');
  console.log('1. Gmail might be blocking emails to your own account');
  console.log('2. Try sending to a different email address');
  console.log('3. Check Gmail security settings');
  console.log('4. Check spam/junk folders');
}

testExternalEmail();
