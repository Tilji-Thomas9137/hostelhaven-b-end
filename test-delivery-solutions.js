// Test different delivery solutions
require('dotenv').config();

const { sendActivationEmailImproved } = require('./utils/improved-gmail-mailer');

async function testDeliverySolutions() {
  console.log('🔧 Testing Email Delivery Solutions...\n');
  
  // Test with different email addresses
  const testEmails = [
    'tilutilji@gmail.com',  // Your email
    'test@gmail.com',       // Different Gmail
    'test@yahoo.com',       // Yahoo
    'test@outlook.com'      // Outlook
  ];
  
  console.log('📧 Testing with improved Gmail SMTP...\n');
  
  for (const email of testEmails) {
    try {
      console.log(`📤 Sending test email to: ${email}`);
      
      const result = await sendActivationEmailImproved({
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
  
  console.log('\n💡 DELIVERY SOLUTIONS IMPLEMENTED:');
  console.log('✅ Improved email headers');
  console.log('✅ Better HTML structure');
  console.log('✅ TLS configuration');
  console.log('✅ Priority headers');
  console.log('✅ Professional formatting');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Check all email accounts for delivered emails');
  console.log('2. If still not receiving, try with a real email address');
  console.log('3. Check Gmail security settings');
  console.log('4. Consider using a different email service');
}

testDeliverySolutions();
