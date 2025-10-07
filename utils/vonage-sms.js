const https = require('https');

// Vonage SMS API
function sendSMS({ to, text }) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    const from = process.env.VONAGE_SMS_FROM || 'HostelHaven';

    const payload = JSON.stringify({
      from,
      to,
      text
    });

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const options = {
      hostname: 'rest.nexmo.com',
      port: 443,
      path: '/sms/json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.messages && response.messages[0].status === '0') {
            console.log(`✅ SMS sent successfully via Vonage: ${response.messages[0]['message-id']}`);
            resolve({ success: true, messageId: response.messages[0]['message-id'] });
          } else {
            console.error(`❌ Vonage SMS failed: ${response.messages[0]['error-text']}`);
            reject(new Error(`Vonage SMS failed: ${response.messages[0]['error-text']}`));
          }
        } catch (error) {
          console.error(`❌ Vonage SMS parsing failed: ${error.message}`);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendActivationSMS({ to, username, activationLink, otpCode }) {
  if (!to) return;

  const message = `HostelHaven Activation\nUsername: ${username}\nOTP: ${otpCode}\nLink: ${activationLink}\nValid for 24h, OTP 10m.`;

  try {
    return await sendSMS({ to, text: message });
  } catch (error) {
    console.error(`❌ Vonage SMS activation failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendActivationSMS,
  sendSMS
};
