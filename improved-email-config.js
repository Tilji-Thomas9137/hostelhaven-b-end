// Improved email configuration for better deliverability
require('dotenv').config();

// Set environment variables before requiring the module
process.env.RESEND_API_KEY = 're_fjZ2sy5m_JoQmswJKwakyFvD5GBmuv9jy';

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendImprovedEmail() {
  console.log('📧 Sending Improved Email for Better Deliverability...\n');

  try {
    const result = await resend.emails.send({
      from: 'HostelHaven <onboarding@resend.dev>',
      to: ['tilutilji@gmail.com'],
      subject: '🎓 HostelHaven Account Activation - Important',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>HostelHaven Activation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎓 HostelHaven</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Smart Hostel Management</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Welcome to HostelHaven!</h2>
            <p>Your account has been created successfully. Here are your login details:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">📋 Account Information</h3>
              <p><strong>Username:</strong> TEST123</p>
              <p><strong>OTP Code:</strong> <span style="background: #e8f5e8; padding: 5px 10px; border-radius: 4px; font-family: monospace; font-size: 18px; font-weight: bold;">123456</span></p>
              <p><strong>Valid for:</strong> 10 minutes</p>
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="http://localhost:5173/activate?token=test123" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                🚀 Activate Account & Set Password
              </a>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #856404;">⚠️ Important Instructions:</h4>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Click the activation button above</li>
                <li>Enter the OTP code: <strong>123456</strong></li>
                <li>Create a strong password</li>
                <li>Complete your account setup</li>
              </ol>
            </div>
          </div>
          
          <div style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;">
            <p>If you didn't request this account, please contact your hostel administration.</p>
            <p><strong>HostelHaven</strong> - Smart Hostel Management System</p>
          </div>
        </body>
        </html>
      `,
      text: `
        HostelHaven Account Activation
        
        Welcome to HostelHaven!
        
        Your account has been created successfully.
        
        Account Information:
        - Username: TEST123
        - OTP Code: 123456
        - Valid for: 10 minutes
        
        To activate your account:
        1. Click this link: http://localhost:5173/activate?token=test123
        2. Enter the OTP code: 123456
        3. Create a strong password
        4. Complete your account setup
        
        If you didn't request this account, please contact your hostel administration.
        
        HostelHaven - Smart Hostel Management System
      `
    });

    console.log('✅ Improved email sent successfully!');
    console.log(`📧 Message ID: ${result.data?.id}`);
    console.log('\n📬 This email should have better deliverability because:');
    console.log('   • Clear subject line with emoji');
    console.log('   • Both HTML and text versions');
    console.log('   • Professional formatting');
    console.log('   • Clear call-to-action');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendImprovedEmail();
