const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Minimal chat history endpoint (stub)
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  res.json({ success: true, data: { messages: [] } });
}));

// Send a chat message via Realtime broadcast (no DB persistence)
router.post('/', authMiddleware, [
  body('channel').notEmpty(),
  body('message').notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { channel, message } = req.body;

  // Identify sender (map auth uid to users.id)
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', req.user.id)
    .single();

  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    message,
    sender_id: userRow?.id || null,
    created_at: new Date().toISOString()
  };

  // Broadcast to realtime channel `chat:<channel>`
  try {
    const ch = supabase.channel(`chat:${channel}`);
    await ch.send({ type: 'broadcast', event: 'new-message', payload });
    await supabase.removeChannel(ch);
  } catch (e) {
    // ignore broadcast errors to avoid user-facing failures
  }

  res.json({ success: true, data: { message: payload } });
}));

module.exports = router;


