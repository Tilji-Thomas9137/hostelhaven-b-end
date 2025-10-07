const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { sendActivationEmail } = require('../utils/resend-mailer');

// Test endpoint (GET) - for verifying the hook is reachable
router.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Auth hook endpoint is working',
    method: 'GET',
    timestamp: new Date().toISOString()
  });
});

// Test SMTP endpoint (GET) - for testing email sending
router.get('/test-smtp', async (req, res) => {
  try {
    const testEmail = req.query.email || 'test@example.com';
    await sendActivationEmail({
      to: testEmail,
      fullName: 'Test User',
      username: 'TEST123',
      activationLink: 'http://localhost:5173/activate?token=test',
      otpCode: '123456'
    });
    res.json({ 
      status: 'OK', 
      message: 'Test email sent successfully',
      to: testEmail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Failed to send test email',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Supabase Auth Hook endpoint (POST)
// Set this URL in Supabase Dashboard → Authentication → Auth Hooks (Signup + Invite)
// Example: http://localhost:3002/api/auth-hooks
router.post('/', async (req, res) => {
  try {
    const event = req.header('x-supabase-event') || req.body?.type || 'unknown';
    const user = req.body?.record || req.body?.user || {};
    const email = user.email || req.body?.email;

    if (!email) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'no-email' });
    }

    // Find our user row to fetch username and activation bundle
    const { data: hhUser } = await supabaseAdmin
      .from('users')
      .select('id, username, full_name, activation_token, otp_code')
      .eq('email', email)
      .single();

    if (!hhUser) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'no-app-user' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${encodeURIComponent(hhUser.activation_token || '')}`;

    await sendActivationEmail({
      to: email,
      fullName: hhUser.full_name,
      username: hhUser.username,
      activationLink,
      otpCode: hhUser.otp_code || ''
    });

    return res.status(200).json({ ok: true, event });
  } catch (err) {
    console.warn('Auth-hook error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

module.exports = router;


