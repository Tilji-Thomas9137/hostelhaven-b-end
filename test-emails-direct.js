// Direct test with environment variables set
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';
process.env.FRONTEND_URL = 'http://localhost:5173';

const { sendActivationEmail } = require('./utils/resend-mailer');

async function testAllUserTypes() {
  console.log('🧪 Testing Beautiful Emails for All User Types...');
  console.log('📧 API Key:', process.env.RESEND_API_KEY ? '✅ Found' : '❌ Missing');
  console.log('📧 From:', process.env.RESEND_FROM || '❌ Missing');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const testEmail = 'tilutilji@gmail.com'; // Your email for testing

  try {
    // Test 1: Student Email
    console.log('\n🎓 Testing STUDENT Email...');
    const studentData = {
      to: testEmail,
      fullName: 'John Doe',
      username: 'STU2024001', // Student admission number
      activationLink: `${frontendUrl}/activate?token=student_test_token_123`,
      otpCode: '123456'
    };

    const studentResult = await sendActivationEmail(studentData);
    console.log('✅ Student email sent successfully!');
    console.log('📧 Message ID:', studentResult.messageId);

    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Parent Email
    console.log('\n👨‍👩‍👧‍👦 Testing PARENT Email...');
    const parentData = {
      to: testEmail,
      fullName: 'Jane Smith',
      username: 'PARENT-STU2024001', // Parent username format
      activationLink: `${frontendUrl}/activate?token=parent_test_token_456`,
      otpCode: '789012'
    };

    const parentResult = await sendActivationEmail(parentData);
    console.log('✅ Parent email sent successfully!');
    console.log('📧 Message ID:', parentResult.messageId);

    // Wait 2 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Staff Email
    console.log('\n👨‍💼 Testing STAFF Email...');
    const staffData = {
      to: testEmail,
      fullName: 'Dr. Michael Johnson',
      username: 'EMP001', // Staff employee ID
      activationLink: `${frontendUrl}/activate?token=staff_test_token_789`,
      otpCode: '345678'
    };

    const staffResult = await sendActivationEmail(staffData);
    console.log('✅ Staff email sent successfully!');
    console.log('📧 Message ID:', staffResult.messageId);

    console.log('\n🎉 All email tests completed successfully!');
    console.log('📬 Check your inbox for 3 beautiful emails:');
    console.log('  1. Student activation email (John Doe - STU2024001)');
    console.log('  2. Parent activation email (Jane Smith - PARENT-STU2024001)');
    console.log('  3. Staff activation email (Dr. Michael Johnson - EMP001)');
    console.log('\nEach email will have:');
    console.log('  ✅ Beautiful gradient design');
    console.log('  ✅ Personalized username');
    console.log('  ✅ Unique OTP code');
    console.log('  ✅ Professional activation button');
    console.log('  ✅ Step-by-step instructions');
    console.log('  ✅ Security notice');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
  }
}

testAllUserTypes();
