// Test sending emails to any address using Resend's shared domain
require('dotenv').config();

// Set environment variables
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';

const { sendActivationEmail } = require('./utils/resend-mailer');

async function testAnyEmail() {
  console.log('📧 Testing Email to Any Address...\n');
  
  // Test with different email addresses
  const testEmails = [
    'tilutilji@gmail.com',  // Your verified email
    'test@example.com',     // Random email
    'student@test.com',     // Another random email
  ];
  
  for (const email of testEmails) {
    try {
      console.log(`📤 Sending test email to: ${email}`);
      
      const result = await sendActivationEmail({
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
  
  console.log('\n🎉 Test completed!');
  console.log('📬 Check your inbox for delivered emails');
}

testAnyEmail();
