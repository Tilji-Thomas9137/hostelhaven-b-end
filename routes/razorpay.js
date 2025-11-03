const express = require('express');
const { body, validationResult } = require('express-validator');
const razorpay = require('../config/razorpay');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/razorpay/create-order
 * @desc    Create a Razorpay order for payment
 * @access  Private
 */
router.post('/create-order', authMiddleware, [
  body('payment_id').notEmpty().withMessage('Payment ID is required'),
  body('currency').optional().isString().withMessage('Currency must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { payment_id, currency = 'INR' } = req.body;
  
  try {
    // Get requester profile (student or parent)
    const { data: requester, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !requester) {
      throw new AuthorizationError('User not found');
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw new ValidationError('Payment record not found');
    }

    // Authorization: student paying own or verified parent
    let authorized = requester.role === 'student' && requester.id === payment.user_id;
    if (!authorized && requester.role === 'parent') {
      const { data: parentLink } = await supabase
        .from('parents')
        .select('verified, user_profiles!inner(user_id)')
        .eq('user_id', requester.id)
        .eq('user_profiles.user_id', payment.user_id)
        .single();
      authorized = !!(parentLink && parentLink.verified);
    }
    if (!authorized) {
      throw new AuthorizationError('Not authorized to create order for this payment');
    }

    if (payment.status === 'paid') {
      throw new ValidationError('Payment already completed');
    }

    // Compute amount with late fee: ₹500/day past due
    const baseAmount = parseFloat(payment.amount) || 0;
    const today = new Date();
    const due = new Date(payment.due_date);
    const daysPastDue = Math.max(0, Math.floor((today.setHours(0,0,0,0) - due.setHours(0,0,0,0)) / (1000*60*60*24)));
    const lateFee = daysPastDue * 500;
    const amount = baseAmount + lateFee;

    // Mark overdue if applicable (best-effort)
    try {
      if (daysPastDue > 0 && payment.status !== 'overdue') {
        await supabase
          .from('payments')
          .update({ status: 'overdue', updated_at: new Date().toISOString() })
          .eq('id', payment_id);
      }
    } catch (_) {}

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `payment_${payment_id}_${Date.now()}`,
      notes: {
        payment_id: payment_id,
        user_id: requester.id,
        payment_type: payment.payment_type
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      }
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}));

/**
 * @route   POST /api/razorpay/verify-payment
 * @desc    Verify Razorpay payment signature
 * @access  Private
 */
router.post('/verify-payment', authMiddleware, [
  body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  body('payment_id').notEmpty().withMessage('Payment ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature, 
    payment_id 
  } = req.body;

  try {
    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userProfile) {
      throw new AuthorizationError('User not found');
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .eq('user_id', userProfile.id)
      .single();

    if (paymentError || !payment) {
      throw new ValidationError('Payment record not found');
    }

    // Verify payment signature
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', 'yc6ZIq8903j3dexTXX4Y51mL')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new ValidationError('Invalid payment signature');
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        payment_method: 'razorpay',
        transaction_reference: razorpay_payment_id,
        paid_at: new Date().toISOString(),
        paid_by: userProfile.id,
        paid_by_role: 'student'
      })
      .eq('id', payment_id)
      .select()
      .single();

    if (updateError) {
      throw new ValidationError('Failed to update payment status');
    }

    res.json({
      success: true,
      data: {
        payment: updatedPayment,
        message: 'Payment verified and completed successfully'
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
}));

/**
 * @route   GET /api/razorpay/payment-methods
 * @desc    Get available payment methods
 * @access  Private
 */
router.get('/payment-methods', authMiddleware, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      methods: [
        {
          id: 'razorpay',
          name: 'Razorpay',
          description: 'Pay with UPI, Cards, Net Banking',
          icon: 'credit-card',
          enabled: true
        }
      ]
    }
  });
}));

module.exports = router;
