// Test sending to different email addresses
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testDifferentEmails() {
  console.log('📧 Testing Email Delivery to Different Addresses...\n');
  
  // Test with different email addresses
  const testEmails = [
    'tilutilji@gmail.com',  // Your email
    'test@gmail.com',       // Different Gmail
    'test@yahoo.com',       // Yahoo
    'test@outlook.com'      // Outlook
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
  
  console.log('\n🔍 CHECK ALL EMAIL ACCOUNTS:');
  console.log('1. tilutilji@gmail.com - Check inbox, spam, promotions');
  console.log('2. test@gmail.com - Check if you have access');
  console.log('3. test@yahoo.com - Check if you have access');
  console.log('4. test@outlook.com - Check if you have access');
  
  console.log('\n💡 If emails are sent but not received:');
  console.log('1. Gmail might be blocking your own emails');
  console.log('2. Check Gmail security settings');
  console.log('3. Try using a different sender email');
}

testDifferentEmails();
