const https = require('https');
// Nodemailer removed - using SendGrid for email gateway SMS

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

function sendViaTwilio({ to, body }) {
  return new Promise((resolve, reject) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    const postData = new URLSearchParams({
      To: to,
      From: from,
      Body: body
    }).toString();

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(new Error(`Twilio SMS failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendActivationSms({ to, username, activationLink, otpCode }) {
  const message = `HostelHaven Activation\nUsername: ${username}\nOTP: ${otpCode}\nLink: ${activationLink}\nValidities: token 24h, OTP 10m.`;

  if (!to) return;

  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();

  if (provider === 'email_gateway') {
    const gatewayDomain = process.env.SMS_EMAIL_GATEWAY_DOMAIN; // e.g., vtext.com
    const from = process.env.SMTP_FROM || 'no-reply@hostelhaven.local';
    if (!gatewayDomain) {
      console.log('[SMS:GATEWAY:SKIP] Missing SMS_EMAIL_GATEWAY_DOMAIN');
      return;
    }

    // Build recipient like 1234567890@carrier-domain
    const digits = String(to).replace(/\D+/g, '');
    const smsRecipient = `${digits}@${gatewayDomain}`;

    // Use SendGrid for email gateway SMS
    const { sendActivationEmail } = require('./sendgrid-mailer');
    
    await sendActivationEmail({
      to: smsRecipient,
      fullName: 'SMS Recipient',
      username: 'SMS',
      activationLink: '',
      otpCode: message
    });
    return;
  }

  if (twilioConfigured()) {
    await sendViaTwilio({ to, body: message });
    return;
  }

  console.log('[SMS:DEV]', { to, message });
}

module.exports = {
  sendActivationSms
};


