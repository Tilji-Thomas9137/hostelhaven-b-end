// Quick email delivery test
require('dotenv').config();

// Set environment variables before requiring the module
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';

const { sendActivationEmail } = require('./utils/resend-mailer');

async function quickTest() {
  console.log('📧 Quick Email Delivery Test\n');
  
  try {
    const result = await sendActivationEmail({
      to: 'tilutilji@gmail.com',
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    });
    
    console.log('✅ Email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log('\n🔍 CHECK THESE LOCATIONS:');
    console.log('1. 📬 Inbox of tilutilji@gmail.com');
    console.log('2. 🗑️ Spam/Junk folder');
    console.log('3. 📁 Promotions tab (Gmail)');
    console.log('4. 🔍 Search for "HostelHaven" in your email');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();
