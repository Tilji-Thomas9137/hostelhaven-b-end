const https = require('https');

function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

function sendViaWhatsAppCloud({ to, body }) {
  return new Promise((resolve, reject) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    });

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(new Error(`WhatsApp API failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendActivationWhatsApp({ to, username, activationLink, otpCode }) {
  if (!to) return;

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const useTemplate = Boolean(templateName);

  if (whatsappConfigured()) {
    if (useTemplate) {
      await sendTemplate({
        to,
        name: templateName,
        language: templateLang,
        parameters: [username, otpCode, activationLink]
      });
    } else {
      const message = `HostelHaven Activation\nUsername: ${username}\nOTP: ${otpCode}\nLink: ${activationLink}\nValidities: token 24h, OTP 10m.`;
      await sendViaWhatsAppCloud({ to, body: message });
    }
  } else {
    console.log('[WHATSAPP:DEV]', { to, username, otpCode, activationLink, templateName });
  }
}

function sendTemplate({ to, name, language, parameters }) {
  return new Promise((resolve, reject) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const components = [
      {
        type: 'body',
        parameters: parameters.map(text => ({ type: 'text', text }))
      }
    ];

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        components
      }
    });

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          reject(new Error(`WhatsApp Template API failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendActivationWhatsApp
};


