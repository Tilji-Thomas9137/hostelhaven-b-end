// Test email sending with verified domain
require('dotenv').config();

// Set environment variables
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <noreply@yourdomain.com>'; // Replace with your verified domain

const { sendActivationEmail } = require('./utils/resend-mailer');

async function testVerifiedDomain() {
  console.log('📧 Testing Email with Verified Domain...\n');
  
  // Test with any email address (not just your verified one)
  const testEmails = [
    'student@example.com',
    'parent@example.com', 
    'anyone@anywhere.com'
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
  
  console.log('\n🎉 If all emails sent successfully, your domain verification is working!');
}

testVerifiedDomain();
