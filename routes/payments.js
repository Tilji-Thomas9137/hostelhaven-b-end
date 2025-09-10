const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/payments/summary
 * @desc    Get payment summary for dashboard
 * @access  Private
 */
router.get('/summary', authMiddleware, asyncHandler(async (req, res) => {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('amount, status, due_date')
    .eq('user_id', req.user.id);

  if (error) {
    throw new ValidationError('Failed to fetch payment summary');
  }

  const summary = {
    total_paid: 0,
    total_pending: 0,
    total_overdue: 0,
    next_due_date: null,
    next_due_amount: 0
  };

  const today = new Date().toISOString().split('T')[0];

  payments.forEach(payment => {
    if (payment.status === 'paid') {
      summary.total_paid += parseFloat(payment.amount);
    } else if (payment.status === 'pending') {
      summary.total_pending += parseFloat(payment.amount);
      
      if (payment.due_date < today) {
        summary.total_overdue += parseFloat(payment.amount);
      } else if (!summary.next_due_date || payment.due_date < summary.next_due_date) {
        summary.next_due_date = payment.due_date;
        summary.next_due_amount = parseFloat(payment.amount);
      }
    }
  });

  res.json({
    success: true,
    data: { summary }
  });
}));

/**
 * @route   GET /api/payments
 * @desc    Get user's payment history
 * @access  Private
 */
router.get('/', authMiddleware, [
  query('status').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, limit = 10, offset = 0 } = req.query;
  
  let query = supabase
    .from('payments')
    .select(`
      *,
      rooms(room_number, floor)
    `)
    .eq('user_id', req.user.id)
    .order('due_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: payments, error } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch payments');
  }

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: payments.length
      }
    }
  });
}));

/**
 * @route   GET /api/payments/:id
 * @desc    Get specific payment details
 * @access  Private
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      rooms(room_number, floor, room_type)
    `)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !payment) {
    throw new ValidationError('Payment not found');
  }

  res.json({
    success: true,
    data: { payment }
  });
}));

/**
 * @route   POST /api/payments/:id/pay
 * @desc    Process payment (mock implementation)
 * @access  Private
 */
router.post('/:id/pay', authMiddleware, [
  body('payment_method').isIn(['online', 'card', 'bank_transfer']),
  body('transaction_id').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { payment_method, transaction_id } = req.body;

  // Check if payment exists and belongs to user
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !payment) {
    throw new ValidationError('Payment not found');
  }

  if (payment.status === 'paid') {
    throw new ValidationError('Payment already completed');
  }

  // Mock payment processing - in real app, integrate with payment gateway
  const { data: updatedPayment, error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      payment_method,
      transaction_id: transaction_id || `TXN_${Date.now()}`,
      paid_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    throw new ValidationError('Failed to process payment');
  }

  // Create notification
  await supabase
    .from('notifications')
    .insert({
      user_id: req.user.id,
      title: 'Payment Successful',
      message: `Your payment of $${payment.amount} has been processed successfully.`,
      type: 'payment'
    });

  res.json({
    success: true,
    message: 'Payment processed successfully',
    data: { payment: updatedPayment }
  });
}));

module.exports = router;