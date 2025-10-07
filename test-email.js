const { sendActivationEmail } = require('./utils/resend-mailer');
require('dotenv').config();

async function testEmail() {
  console.log('🧪 Testing Resend Email...');
  console.log('📧 API Key:', process.env.RESEND_API_KEY ? '✅ Found' : '❌ Missing');
  console.log('📧 From:', process.env.RESEND_FROM || '❌ Missing');
  
  if (!process.env.RESEND_API_KEY) {
    console.log('❌ Please set RESEND_API_KEY in your config.env file');
    return;
  }

  try {
    const testData = {
      to: 'tilutilji@gmail.com', // Your email for testing
      fullName: 'Test User',
      username: 'test_user_2024',
      activationLink: 'https://yourhostel.com/activate?token=test123',
      otpCode: '123456'
    };

    console.log('📤 Sending test email...');
    const result = await sendActivationEmail(testData);
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your inbox for the beautiful email!');
    
  } catch (error) {
    console.error('❌ Email failed:', error.message);
  }
}

testEmail();
