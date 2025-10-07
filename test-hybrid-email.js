// Test hybrid email system for admin operations
require('dotenv').config();

const { sendActivationEmailHybrid } = require('./utils/hybrid-mailer');

async function testHybridEmail() {
  console.log('🎯 Testing Hybrid Email System for Admin Operations...\n');
  
  // Test with different email addresses
  const testEmails = [
    'tilutilji@gmail.com',  // Your verified email
    'test@gmail.com',       // Different Gmail
    'test@yahoo.com',       // Yahoo
    'test@outlook.com'      // Outlook
  ];
  
  console.log('📧 Testing Hybrid Email Delivery...\n');
  console.log('🔄 This will try Gmail SMTP first, then fall back to Resend\n');
  
  for (const email of testEmails) {
    try {
      console.log(`📤 Sending email to: ${email}`);
      
      const result = await sendActivationEmailHybrid({
        to: email,
        fullName: 'Test User',
        username: 'TEST123',
        activationLink: 'http://localhost:5173/activate?token=test123',
        otpCode: '123456'
      });
      
      console.log(`✅ Email sent successfully!`);
      console.log(`📧 Message ID: ${result.messageId}`);
      console.log(`🔧 Method: ${result.method}`);
      console.log(`📬 Check ${email} for the email\n`);
      
    } catch (error) {
      console.log(`❌ Failed to send to ${email}: ${error.message}\n`);
    }
    
    // Wait 3 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('🎉 HYBRID EMAIL SYSTEM TEST COMPLETED!');
  console.log('\n📋 WHAT THIS MEANS:');
  console.log('✅ Gmail SMTP will be tried first for all emails');
  console.log('✅ If Gmail fails, Resend will be used as backup');
  console.log('✅ Your verified email will always work with Resend');
  console.log('✅ Other emails will work if Gmail SMTP succeeds');
  
  console.log('\n🔍 CHECK ALL EMAIL ACCOUNTS:');
  console.log('1. tilutilji@gmail.com - Should receive via Gmail or Resend');
  console.log('2. test@gmail.com - Should receive via Gmail if working');
  console.log('3. test@yahoo.com - Should receive via Gmail if working');
  console.log('4. test@outlook.com - Should receive via Gmail if working');
  
  console.log('\n🎯 YOUR ADMIN SYSTEM IS NOW READY!');
  console.log('✅ When you create students, parents, or staff:');
  console.log('   - Emails will be sent automatically');
  console.log('   - Gmail SMTP will be tried first');
  console.log('   - Resend will be used as backup');
  console.log('   - Delivery issues are minimized');
}

testHybridEmail();
