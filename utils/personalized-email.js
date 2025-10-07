const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPersonalizedEmail({ 
  to, 
  fullName, 
  username, 
  roomNumber, 
  hostelName, 
  activationLink, 
  otpCode,
  emailType = 'activation' 
}) {
  const from = process.env.RESEND_FROM || 'HostelHaven <noreply@hostelhaven.com>';
  
  let subject, html, text;
  
  if (emailType === 'activation') {
    subject = `Welcome to ${hostelName || 'HostelHaven'} | Activate your account`;
    
    html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${hostelName || 'HostelHaven'} Activation</title>
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="min-height: 100vh; padding: 40px 20px; display: flex; align-items: center; justify-content: center;">
        <div style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); position: relative;">
          
          <!-- Header with Gradient Background -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"%23ffffff\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"%23ffffff\" opacity=\"0.1\"/><circle cx=\"50\" cy=\"10\" r=\"0.5\" fill=\"%23ffffff\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>'); opacity: 0.3;"></div>
            
            <!-- Logo -->
            <div style="position: relative; z-index: 2;">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3);">
                <div style="width: 50px; height: 50px; background: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #667eea;">H</div>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${hostelName || 'HostelHaven'}</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 500;">Smart Hostel Management</p>
            </div>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">
            <!-- Welcome Message -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #1a202c; font-size: 28px; font-weight: 700; margin: 0 0 10px; letter-spacing: -0.01em;">Welcome${fullName ? `, ${fullName}` : ''}! 🎉</h2>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">Your account has been created by the hostel administration. Use the details below to activate your account and set your password.</p>
            </div>

            <!-- Account Details Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; max-width: 500px; margin-left: auto; margin-right: auto;">
              <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; transition: all 0.3s ease;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 24px;">👤</span>
                </div>
                <div style="color: #718096; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Username</div>
                <div style="color: #1a202c; font-weight: 700; font-size: 18px; word-break: break-all;">${username}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); border: 2px solid #9ae6b4; border-radius: 16px; padding: 24px; text-align: center; transition: all 0.3s ease;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #48bb78, #38a169); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 24px;">🔐</span>
                </div>
                <div style="color: #2f855a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">OTP Code</div>
                <div style="color: #1a202c; font-weight: 700; font-size: 24px; letter-spacing: 3px; font-family: 'Courier New', monospace;">${otpCode}</div>
                <div style="color: #2f855a; font-size: 12px; margin-top: 6px; font-weight: 500;">Valid for 10 minutes</div>
              </div>
            </div>

            <!-- Activation Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${activationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); transition: all 0.3s ease; position: relative; overflow: hidden;">
                <span style="position: relative; z-index: 2;">🚀 Activate Account & Set Password</span>
                <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transition: left 0.5s ease;"></div>
              </a>
            </div>

            <!-- Instructions -->
            <div style="background: #f7fafc; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0 0 12px; display: flex; align-items: center;">
                <span style="margin-right: 8px;">📋</span>
                Activation Instructions
              </h3>
              <ol style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Click the "Activate Account" button above</li>
                <li style="margin-bottom: 8px;">Enter the OTP code: <strong style="color: #667eea; font-family: 'Courier New', monospace;">${otpCode}</strong></li>
                <li style="margin-bottom: 8px;">Create a strong password (minimum 8 characters)</li>
                <li style="margin-bottom: 0;">Confirm your password and click "Activate"</li>
              </ol>
            </div>

            <!-- Backup Link -->
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 14px; margin: 0 0 12px; font-weight: 500;">If the button doesn't work, copy and paste this link:</p>
              <div style="background: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 12px; word-break: break-all;">
                <a href="${activationLink}" style="color: #667eea; text-decoration: none; font-size: 13px; font-family: 'Courier New', monospace;">${activationLink}</a>
              </div>
            </div>

            <!-- Security Notice -->
            <div style="text-align: center; margin-top: 30px; padding: 16px; background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%); border: 1px solid #feb2b2; border-radius: 12px;">
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <span style="margin-right: 8px; font-size: 18px;">🔒</span>
                <span style="color: #c53030; font-weight: 600; font-size: 14px;">Security Notice</span>
              </div>
              <p style="color: #742a2a; font-size: 13px; margin: 0; line-height: 1.5;">
                Do not share this OTP with anyone. This activation link expires in 24 hours. 
                If you didn't request this account, please contact your hostel administration.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #6c757d; font-size: 14px; margin: 0 0 8px;">Powered by ${hostelName || 'HostelHaven'}</p>
            <p style="color: #adb5bd; font-size: 12px; margin: 0;">Smart Hostel Management System</p>
          </div>
        </div>
      </div>
    </body>
    </html>`;
    
    text = `${hostelName || 'HostelHaven'}\n\nWelcome ${fullName || 'Student'}!\n\nUsername: ${username}\nRoom: ${roomNumber || 'TBD'}\nActivation: ${activationLink}\nOTP: ${otpCode}`;
  }
  
  // Add more email types here (welcome, reminder, etc.)
  else if (emailType === 'welcome') {
    subject = `Welcome to ${hostelName || 'HostelHaven'} | Your account is ready!`;
    
    html = `
    <div style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; background: #0ea5e9; background: linear-gradient(135deg,#f59e0b 0%, #f97316 100%); padding: 32px 20px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(2,6,23,0.12)">
        <div style="padding:28px 28px 16px; text-align:center;">
          <div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#f97316);margin:0 auto 12px"></div>
          <h1 style="margin:0;color:#0f172a;font-size:24px;font-weight:800;letter-spacing:-0.02em">${hostelName || 'HostelHaven'}</h1>
        </div>
        <div style="padding:0 28px 28px">
          <h2 style="color:#0f172a;font-size:20px;letter-spacing:-0.02em;margin:12px 0 16px">Welcome${fullName ? `, ${fullName}` : ''}!</h2>
          <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 12px">Your account is now active and ready to use. You can now access all hostel services.</p>
          
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0">
            <h3 style="color:#0f172a;font-size:16px;margin:0 0 8px">Your Account Details:</h3>
            <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Username:</strong> ${username}</p>
            <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Room:</strong> ${roomNumber || 'TBD'}</p>
            <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Hostel:</strong> ${hostelName || 'HostelHaven'}</p>
          </div>
        </div>
      </div>
    </div>`;
    
    text = `Welcome to ${hostelName || 'HostelHaven'}!\n\nYour account is ready:\nUsername: ${username}\nRoom: ${roomNumber || 'TBD'}`;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`✅ Personalized email sent successfully: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`❌ Personalized email failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendPersonalizedEmail
};
