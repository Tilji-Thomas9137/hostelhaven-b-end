// Test sending to a real external email address
require('dotenv').config();

const { sendActivationEmailGmail } = require('./utils/gmail-mailer');

async function testRealEmail() {
  console.log('📧 Testing Email Delivery to Real External Address...\n');
  
  // Test with a real email address (change this to an email you have access to)
  const testEmails = [
    'tilutilji@gmail.com',  // Your email (might be blocked)
    'test@gmail.com',       // Another Gmail (if you have access)
    'test@yahoo.com',       // Yahoo (if you have access)
    'test@outlook.com'      // Outlook (if you have access)
  ];
  
  console.log('🔍 Testing with multiple email addresses...\n');
  
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
      console.log(`📬 Check ${email} for the email`);
      
    } catch (error) {
      console.log(`❌ Failed to send to ${email}: ${error.message}`);
    }
    
    // Wait 3 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n🔍 CHECK ALL EMAIL ACCOUNTS:');
  console.log('1. tilutilji@gmail.com - Check inbox, spam, promotions');
  console.log('2. test@gmail.com - Check if you have access');
  console.log('3. test@yahoo.com - Check if you have access');
  console.log('4. test@outlook.com - Check if you have access');
  
  console.log('\n💡 POSSIBLE ISSUES:');
  console.log('1. Gmail blocking self-sent emails');
  console.log('2. Gmail spam filters being too aggressive');
  console.log('3. Email addresses not real/accessible');
  console.log('4. Gmail security policies');
  
  console.log('\n🔧 SOLUTIONS:');
  console.log('1. Try with a different Gmail account');
  console.log('2. Check Gmail security settings');
  console.log('3. Use a different email service');
  console.log('4. Check spam/junk folders');
}

testRealEmail();
