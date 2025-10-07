require('dotenv').config({ path: './config.env' });

(async () => {
  try {
    const { sendActivationWhatsApp } = require('../utils/whatsapp');
    const to = process.argv[2];
    if (!to) {
      console.log('Usage: node scripts/test-whatsapp.js <E164_PHONE>');
      process.exit(1);
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    await sendActivationWhatsApp({
      to,
      username: 'TESTUSER',
      activationLink: `${frontendUrl}/activate?token=TESTTOKEN`,
      otpCode: '123456'
    });
    console.log('WhatsApp test message sent (or logged in dev).');
  } catch (e) {
    console.error('WhatsApp test failed:', e.message);
    process.exit(1);
  }
})();


