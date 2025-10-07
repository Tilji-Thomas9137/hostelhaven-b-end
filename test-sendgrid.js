const { sendActivationEmail } = require('./utils/sendgrid-mailer');

// Load environment variables
require('dotenv').config({ path: './config.env' });

async function testSendGrid() {
  console.log('🧪 Testing SendGrid email functionality...\n');
  
  // Check environment variables
  console.log('📧 SendGrid Configuration:');
  console.log(`   SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? '***SET***' : 'NOT SET'}`);
  console.log(`   SENDGRID_FROM: ${process.env.SENDGRID_FROM || 'NOT SET'}`);
  console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || 'NOT SET'}`);
  
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY.includes('your_sendgrid_api_key_here')) {
    console.log('\n❌ SendGrid API Key not configured!');
    console.log('\n🔧 Setup Instructions:');
    console.log('1. Go to: https://app.sendgrid.com/');
    console.log('2. Sign up for free account');
    console.log('3. Go to Settings → API Keys');
    console.log('4. Create API Key with "Full Access"');
    console.log('5. Copy the API key');
    console.log('6. Update config.env:');
    console.log('   SENDGRID_API_KEY=SG.your_actual_api_key_here');
    console.log('   SENDGRID_FROM=noreply@yourdomain.com');
    return;
  }
  
  // Test email sending
  console.log('\n🧪 Testing SendGrid email sending...');
  
  try {
    const testEmail = {
      to: 'test@example.com', // This will fail but we'll see the error
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test123',
      otpCode: '123456'
    };
    
    console.log('   Sending test email via SendGrid...');
    const result = await sendActivationEmail(testEmail);
    console.log('   ✅ SendGrid email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    
  } catch (error) {
    console.log('   ❌ SendGrid email sending failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('API key')) {
      console.log('   💡 Fix: Check your SENDGRID_API_KEY in config.env');
    } else if (error.message.includes('from')) {
      console.log('   💡 Fix: Check your SENDGRID_FROM in config.env');
    } else if (error.message.includes('unauthorized')) {
      console.log('   💡 Fix: Verify your SendGrid API key is correct');
    }
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Get SendGrid API key from: https://app.sendgrid.com/settings/api_keys');
  console.log('2. Update config.env with your API key');
  console.log('3. Test again with: node test-sendgrid.js');
  console.log('4. Restart server: npm start');
  console.log('5. Add a student to test real email sending');
}

// Run the test
testSendGrid().then(() => {
  console.log('\n🎉 SendGrid test completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
