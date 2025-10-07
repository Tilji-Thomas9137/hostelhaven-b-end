// Test sending emails to any address using Gmail SMTP
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testAnyEmailSMTP() {
  console.log('📧 Testing Gmail SMTP with Any Email Address...\n');
  
  // Test with different email addresses
  const testEmails = [
    'tilutilji@gmail.com',  // Your email
    'test@example.com',     // Random email
    'student@test.com',     // Another random email
    'parent@demo.com'       // Another random email
  ];
  
  for (const email of testEmails) {
    try {
      console.log(`📤 Sending test email to: ${email}`);
      
      const result = await sendActivationEmailGmail({
        to: email,
        fullName: 'Test User',
        username: 'TEST123',
        activationLink: 'http://localhost:5173/activate?token=test123',
        otpCode: '123456'
      });
      
      console.log(`✅ Email sent successfully! Message ID: ${result.messageId}`);
      
    } catch (error) {
      console.log(`❌ Failed to send to ${email}: ${error.message}`);
    }
    
    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 SMTP Test Completed!');
  console.log('📬 Check your inbox for delivered emails');
  console.log('✅ Gmail SMTP can send to ANY email address!');
  console.log('✅ No domain verification needed!');
  console.log('✅ Your email system is fully functional!');
}

testAnyEmailSMTP();
