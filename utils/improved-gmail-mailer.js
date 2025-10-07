// Improved Gmail SMTP with better delivery
const nodemailer = require('nodemailer');

// Create transporter with improved settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  // Add these settings for better delivery
  tls: {
    rejectUnauthorized: false
  },
  // Add headers for better deliverability
  headers: {
    'X-Priority': '1',
    'X-MSMail-Priority': 'High',
    'Importance': 'high'
  }
});

async function sendActivationEmailImproved({ to, fullName, username, activationLink, otpCode }) {
  try {
    // Create a more deliverable email
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HostelHaven Activation</title>
      </head>
      <body style="margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">HostelHaven</h1>
            <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Smart Hostel Management</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="color: #333; font-size: 24px; margin: 0 0 20px; text-align: center;">Welcome${fullName ? `, ${fullName}` : ''}!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Your account has been created successfully. Here are your login details:
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 15px; color: #333; font-size: 18px;">Account Information</h3>
              <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>OTP Code:</strong> <span style="background: #e8f5e8; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #2d5a2d;">${otpCode}</span></p>
              <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Valid for:</strong> 10 minutes</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationLink}" style="display: inline-block; background: #667eea; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">Activate Account & Set Password</a>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin: 0 0 10px; color: #856404; font-size: 16px;">Instructions:</h4>
              <ol style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px;">
                <li>Click the activation button above</li>
                <li>Enter the OTP code: <strong>${otpCode}</strong></li>
                <li>Create a strong password</li>
                <li>Complete your account setup</li>
              </ol>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">HostelHaven - Smart Hostel Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      HostelHaven Account Activation
      
      Welcome${fullName ? `, ${fullName}` : ''}!
      
      Your account has been created successfully.
      
      Account Information:
      - Username: ${username}
      - OTP Code: ${otpCode}
      - Valid for: 10 minutes
      
      To activate your account:
      1. Click this link: ${activationLink}
      2. Enter the OTP code: ${otpCode}
      3. Create a strong password
      4. Complete your account setup
      
      If you didn't request this account, please contact your hostel administration.
      
      HostelHaven - Smart Hostel Management System
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'HostelHaven <tilutilji@gmail.com>',
      to: to,
      subject: 'HostelHaven Account Activation - Important',
      html: html,
      text: text,
      // Add headers for better deliverability
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'HostelHaven System'
      }
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully via Gmail SMTP: ${result.messageId}`);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    console.error(`❌ Gmail SMTP email failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendActivationEmailImproved
};
