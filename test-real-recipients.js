// Test email delivery to real recipients
require('dotenv').config();

const { sendActivationEmailImproved } = require('./utils/improved-gmail-mailer');

async function testRealRecipients() {
  console.log('📧 Testing Email Delivery to Real Recipients...\n');
  
  // Test with real email addresses (change these to real emails you have access to)
  const testRecipients = [
    {
      type: 'Student',
      email: 'tilutilji@gmail.com',  // Your email for testing
      name: 'Test Student',
      username: 'STU001'
    },
    {
      type: 'Parent', 
      email: 'test@gmail.com',  // Change to a real email you have access to
      name: 'Test Parent',
      username: 'PARENT-STU001'
    },
    {
      type: 'Staff',
      email: 'test@yahoo.com',  // Change to a real email you have access to
      name: 'Test Staff',
      username: 'EMP001'
    }
  ];
  
  console.log('🎯 Testing with improved Gmail SMTP...\n');
  
  for (const recipient of testRecipients) {
    try {
      console.log(`📤 Sending ${recipient.type} email to: ${recipient.email}`);
      
      const result = await sendActivationEmailImproved({
        to: recipient.email,
        fullName: recipient.name,
        username: recipient.username,
        activationLink: 'http://localhost:5173/activate?token=test123',
        otpCode: '123456'
      });
      
      console.log(`✅ ${recipient.type} email sent successfully!`);
      console.log(`📧 Message ID: ${result.messageId}`);
      console.log(`📬 Check ${recipient.email} for the email\n`);
      
    } catch (error) {
      console.log(`❌ Failed to send ${recipient.type} email: ${error.message}\n`);
    }
    
    // Wait 3 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('🔍 CHECK ALL EMAIL ACCOUNTS:');
  console.log('1. tilutilji@gmail.com - Check inbox, spam, promotions');
  console.log('2. test@gmail.com - Check if you have access');
  console.log('3. test@yahoo.com - Check if you have access');
  
  console.log('\n💡 IF EMAILS ARE NOT RECEIVED:');
  console.log('1. Gmail might be blocking emails from your account');
  console.log('2. Check spam/junk folders');
  console.log('3. Try with a different email address');
  console.log('4. Consider using Resend with domain verification');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Check all email accounts for delivered emails');
  console.log('2. If not receiving, try with real email addresses you have access to');
  console.log('3. Update the email addresses in this test script');
  console.log('4. Run the test again');
}

testRealRecipients();
