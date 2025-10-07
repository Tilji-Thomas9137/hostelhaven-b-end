// Gmail SMTP email service as backup
const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendActivationEmailGmail({ to, fullName, username, activationLink, otpCode }) {
  try {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HostelHaven Activation</title>
      </head>
      <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="min-height: 100vh; padding: 40px 20px; display: flex; align-items: center; justify-content: center;">
          <div style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800;">HostelHaven</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Smart Hostel Management</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a202c; font-size: 28px; font-weight: 700; margin: 0 0 20px; text-align: center;">Welcome${fullName ? `, ${fullName}` : ''}! 🎉</h2>
              
              <div style="background: #f7fafc; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Account Information</h3>
                <p style="color: #4a5568; font-size: 14px; margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                <p style="color: #4a5568; font-size: 14px; margin: 5px 0;"><strong>OTP Code:</strong> <span style="background: #e8f5e8; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: bold;">${otpCode}</span></p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${activationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px;">🚀 Activate Account & Set Password</a>
              </div>

              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #856404;">Instructions:</h4>
                <ol style="margin: 10px 0; padding-left: 20px; color: #856404;">
                  <li>Click the activation button above</li>
                  <li>Enter the OTP code: <strong>${otpCode}</strong></li>
                  <li>Create a strong password</li>
                  <li>Complete your account setup</li>
                </ol>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 14px; margin: 0;">HostelHaven - Smart Hostel Management System</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'HostelHaven <noreply@hostelhaven.com>',
      to: to,
      subject: '🎓 HostelHaven Account Activation - Important',
      html: html,
      text: `
        HostelHaven Account Activation
        
        Welcome to HostelHaven!
        
        Account Information:
        - Username: ${username}
        - OTP Code: ${otpCode}
        
        To activate: ${activationLink}
      `
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
  sendActivationEmailGmail
};
