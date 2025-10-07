// Test email sending to verified address only
require('dotenv').config();

// Set environment variables
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';

const { sendActivationEmail } = require('./utils/resend-mailer');

async function testWithVerifiedEmail() {
  console.log('📧 Testing Email to Verified Address Only...\n');
  
  const verifiedEmail = 'tilutilji@gmail.com'; // Your verified email
  
  try {
    // Test Student Email
    console.log('📤 Sending Student Email to verified address...');
    const studentResult = await sendActivationEmail({
      to: verifiedEmail,
      fullName: 'Aswin Murali',
      username: 'ADM2026001',
      activationLink: 'http://localhost:5173/activate?token=student_token_123',
      otpCode: '123456'
    });
    console.log(`✅ Student email sent! Message ID: ${studentResult.messageId}`);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Parent Email
    console.log('📤 Sending Parent Email to verified address...');
    const parentResult = await sendActivationEmail({
      to: verifiedEmail,
      fullName: 'Muraleedharan',
      username: 'PARENT-ADM2026001',
      activationLink: 'http://localhost:5173/activate?token=parent_token_456',
      otpCode: '789012'
    });
    console.log(`✅ Parent email sent! Message ID: ${parentResult.messageId}`);
    
    console.log('\n🎉 SUCCESS! Check your inbox at tilutilji@gmail.com');
    console.log('📬 You should see 2 beautiful emails there!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithVerifiedEmail();
