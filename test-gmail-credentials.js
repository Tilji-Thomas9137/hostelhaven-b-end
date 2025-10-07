// Test Gmail SMTP credentials and configuration
require('dotenv').config();

const nodemailer = require('nodemailer');

async function testGmailCredentials() {
  console.log('🔍 Testing Gmail SMTP Credentials...\n');
  
  // Check environment variables
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  
  console.log('📋 Current Configuration:');
  console.log(`   SMTP_USER: ${smtpUser}`);
  console.log(`   SMTP_PASS: ${smtpPass ? smtpPass.substring(0, 4) + '****' : 'NOT SET'}`);
  console.log(`   SMTP_FROM: ${smtpFrom}`);
  
  if (!smtpUser || !smtpPass || smtpPass === 'oraz xjsm osyb aqpd') {
    console.log('\n❌ Gmail SMTP not properly configured!');
    console.log('\n🔧 Please complete these steps:');
    console.log('1. Enable 2-Factor Authentication on Gmail');
    console.log('2. Generate App Password: https://myaccount.google.com/apppasswords');
    console.log('3. Update SMTP_PASS in config.env with your 16-character app password');
    return;
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  
  // Test connection
  try {
    console.log('\n🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Test sending a simple email
    console.log('\n📤 Testing email sending...');
    const testEmail = {
      from: smtpFrom,
      to: 'tilutilji@gmail.com',
      subject: 'Test Email from HostelHaven',
      text: 'This is a test email to verify Gmail SMTP is working.',
      html: '<h1>Test Email</h1><p>This is a test email to verify Gmail SMTP is working.</p>'
    };
    
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log('\n📬 Check your inbox at tilutilji@gmail.com');
    console.log('   - Main inbox');
    console.log('   - Spam/Junk folder');
    console.log('   - Promotions tab');
    
  } catch (error) {
    console.error('❌ Gmail SMTP test failed:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n🔧 App Password Issue:');
      console.log('1. Make sure 2-Factor Authentication is enabled');
      console.log('2. Generate a new App Password');
      console.log('3. Use the 16-character password (not your regular password)');
    } else if (error.message.includes('Less secure app access')) {
      console.log('\n🔧 Security Issue:');
      console.log('1. Enable 2-Factor Authentication');
      console.log('2. Generate App Password');
      console.log('3. Disable "Less secure app access"');
    }
  }
}

testGmailCredentials();
