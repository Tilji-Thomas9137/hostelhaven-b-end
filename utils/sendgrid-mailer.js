const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendActivationEmail({ to, fullName, username, activationLink, otpCode }) {
  const from = process.env.SENDGRID_FROM || 'noreply@hostelhaven.com';
  const subject = 'HostelHaven | Activate your account';
  
  const html = `
  <div style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; background: #0ea5e9; background: linear-gradient(135deg,#f59e0b 0%, #f97316 100%); padding: 32px 20px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(2,6,23,0.12)">
      <div style="padding:28px 28px 16px; text-align:center;">
        <div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#f97316);margin:0 auto 12px"></div>
        <h1 style="margin:0;color:#0f172a;font-size:24px;font-weight:800;letter-spacing:-0.02em">HostelHaven</h1>
        <p style="margin:6px 0 0;color:#334155;font-size:14px">Smart Management</p>
      </div>
      <div style="padding:0 28px 28px">
        <h2 style="color:#0f172a;font-size:20px;letter-spacing:-0.02em;margin:12px 0 16px">Welcome${fullName ? `, ${fullName}` : ''}!</h2>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 12px">Your account has been created by the hostel administration. Use the details below to activate your account.</p>

        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0 20px">
          <div style="flex:1 1 220px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px">
            <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase">Username</div>
            <div style="color:#0f172a;font-weight:700;margin-top:2px">${username}</div>
          </div>
          <div style="flex:1 1 220px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px">
            <div style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase">OTP (10 min)</div>
            <div style="color:#0f172a;font-weight:700;margin-top:2px">${otpCode}</div>
          </div>
        </div>

        <a href="${activationLink}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Confirm Your Email & Set Password</a>

        <p style="color:#64748b;font-size:12px;margin:16px 0 0">If the button doesn't work, copy and paste this link:</p>
        <p style="color:#0ea5e9;font-size:12px;word-break:break-all;margin:4px 0 0"><a href="${activationLink}">${activationLink}</a></p>

        <p style="color:#94a3b8;font-size:12px;margin:18px 0 0">Do not share this OTP with anyone. This link expires in 24 hours.</p>
      </div>
    </div>
  </div>`;

  const text = `HostelHaven\n\nUsername: ${username}\nActivation: ${activationLink}\nOTP: ${otpCode}`;

  const msg = {
    to,
    from,
    subject,
    text,
    html
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`✅ Email sent successfully via SendGrid: ${response[0].headers['x-message-id']}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error(`❌ SendGrid email failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendActivationEmail
};
