// Test email delivery and check for issues
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testEmailDelivery() {
  console.log('📧 Testing Email Delivery Issues...\n');
  
  // Test with a simple email first
  try {
    console.log('📤 Sending simple test email...');
    
    const result = await sendActivationEmailGmail({
      to: 'tilutilji@gmail.com',
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    });
    
    console.log(`✅ Email sent successfully! Message ID: ${result.messageId}`);
    console.log('\n🔍 CHECK THESE LOCATIONS:');
    console.log('1. 📬 Main inbox');
    console.log('2. 🗑️ Spam/Junk folder');
    console.log('3. 📁 Promotions tab (Gmail)');
    console.log('4. 📁 Updates tab (Gmail)');
    console.log('5. 🔍 Search for "HostelHaven"');
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
  }
  
  console.log('\n🔧 TROUBLESHOOTING STEPS:');
  console.log('1. Check if Gmail is blocking emails from your account');
  console.log('2. Check Gmail security settings');
  console.log('3. Try adding your Gmail address to contacts');
  console.log('4. Check if there are any email filters');
  
  console.log('\n💡 ALTERNATIVE SOLUTIONS:');
  console.log('1. Try sending to a different email address');
  console.log('2. Check Gmail app password settings');
  console.log('3. Verify SMTP configuration');
}

testEmailDelivery();