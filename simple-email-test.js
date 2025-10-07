image.png// Simple email test with your app password
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function simpleEmailTest() {
  console.log('📧 Simple Email Test with Your App Password\n');
  
  try {
    console.log('📤 Sending test email to: tilutilji@gmail.com');
    
    const result = await sendActivationEmailGmail({
      to: 'tilutilji@gmail.com',
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    });
    
    console.log('✅ Email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    
    console.log('\n📬 NOW CHECK YOUR GMAIL:');
    console.log('1. Go to: https://mail.google.com');
    console.log('2. Check MAIN INBOX');
    console.log('3. Check SPAM/JUNK folder');
    console.log('4. Check PROMOTIONS tab');
    console.log('5. Search for "HostelHaven"');
    
    console.log('\n🎉 If you see the email, your system is working!');
    console.log('🎉 If not, Gmail might be blocking it for security reasons.');
    
  } catch (error) {
    console.error('❌ Email failed:', error.message);
  }
}

simpleEmailTest();
