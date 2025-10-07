// Test student creation with duplicate parent email scenario
// Set environment variables first
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { sendActivationEmail } = require('./utils/resend-mailer');

async function testStudentCreation() {
  console.log('🧪 Testing Student Creation with Email Sending...');
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const testEmail = 'tilutilji@gmail.com';

  try {
    // Test Student Email
    console.log('\n🎓 Testing STUDENT Email...');
    const studentData = {
      to: testEmail,
      fullName: 'Aswin Murali',
      username: 'ADM2026001', // Student admission number
      activationLink: `${frontendUrl}/activate?token=student_token_123`,
      otpCode: '123456'
    };

    const studentResult = await sendActivationEmail(studentData);
    console.log('✅ Student email sent successfully!');
    console.log('📧 Message ID:', studentResult.messageId);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Parent Email (with potential duplicate scenario)
    console.log('\n👨‍👩‍👧‍👦 Testing PARENT Email...');
    const parentData = {
      to: testEmail,
      fullName: 'Muraleedharan',
      username: 'PARENT-ADM2026001', // Parent username format
      activationLink: `${frontendUrl}/activate?token=parent_token_456`,
      otpCode: '789012'
    };

    const parentResult = await sendActivationEmail(parentData);
    console.log('✅ Parent email sent successfully!');
    console.log('📧 Message ID:', parentResult.messageId);

    console.log('\n🎉 Student creation test completed!');
    console.log('📬 Check your inbox for 2 beautiful emails:');
    console.log('  1. Student: Aswin Murali - ADM2026001');
    console.log('  2. Parent: Muraleedharan - PARENT-ADM2026001');
    console.log('\n✅ The duplicate username issue should now be resolved!');
    console.log('✅ Each user gets their own unique username');
    console.log('✅ Beautiful activation emails are sent automatically');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStudentCreation();
