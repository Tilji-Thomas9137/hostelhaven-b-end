// Setup Resend with domain verification for better delivery
require('dotenv').config();

const { Resend } = require('resend');

// Set environment variables
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';
process.env.RESEND_FROM = 'HostelHaven <onboarding@resend.dev>';

const resend = new Resend(process.env.RESEND_API_KEY);

async function setupResendDomain() {
  console.log('🚀 Setting up Resend with Domain Verification...\n');
  
  console.log('📋 CURRENT STATUS:');
  console.log('✅ Resend API Key: Configured');
  console.log('✅ Resend From: onboarding@resend.dev');
  console.log('✅ Can send to verified email: tilutilji@gmail.com');
  console.log('❌ Cannot send to other emails (domain not verified)');
  
  console.log('\n🔧 SOLUTIONS FOR BETTER DELIVERY:');
  
  console.log('\n1. 🆓 GET A FREE DOMAIN:');
  console.log('   - Go to: https://freenom.com');
  console.log('   - Register: hostelhaven.tk (or similar)');
  console.log('   - Verify domain with Resend');
  console.log('   - Send to ANY email address');
  
  console.log('\n2. 💰 BUY A CHEAP DOMAIN:');
  console.log('   - Go to: https://namecheap.com');
  console.log('   - Buy: hostelhaven.com ($1-2/year)');
  console.log('   - Verify domain with Resend');
  console.log('   - Professional email addresses');
  
  console.log('\n3. 🔄 USE GMAIL SMTP (Current):');
  console.log('   - Working but delivery issues');
  console.log('   - Gmail blocking self-sent emails');
  console.log('   - Need to check spam folders');
  
  console.log('\n4. 📧 TEST WITH REAL EMAIL:');
  console.log('   - Use a different email address');
  console.log('   - Test if Gmail SMTP works with external emails');
  console.log('   - Check delivery to other providers');
  
  console.log('\n🎯 RECOMMENDED NEXT STEPS:');
  console.log('1. Try sending to a different email address first');
  console.log('2. If that works, the issue is Gmail self-sending');
  console.log('3. If not, get a free domain and use Resend');
  console.log('4. This will solve all delivery issues');
  
  // Test with Resend to verified email
  try {
    console.log('\n📤 Testing Resend to verified email...');
    
    const result = await resend.emails.send({
      from: 'HostelHaven <onboarding@resend.dev>',
      to: ['tilutilji@gmail.com'],
      subject: 'HostelHaven Test - Resend Delivery',
      html: `
        <h1>HostelHaven Test Email</h1>
        <p>This is a test email from Resend to verify delivery.</p>
        <p>If you receive this, Resend is working perfectly!</p>
      `
    });
    
    console.log(`✅ Resend email sent! Message ID: ${result.data?.id}`);
    console.log('📬 Check tilutilji@gmail.com for this email');
    
  } catch (error) {
    console.log(`❌ Resend test failed: ${error.message}`);
  }
}

setupResendDomain();
