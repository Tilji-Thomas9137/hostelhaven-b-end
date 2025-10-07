const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin access
const adminMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'hostel_operations_assistant', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin access required');
  }
};

/**
 * @route   GET /api/payments
 * @desc    Get all payments (Admin only)
 * @access  Private (Admin)
 */
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        *,
        users!payments_user_id_fkey(
          id,
          full_name,
          email,
          username
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new ValidationError('Failed to fetch payments');
    }

    res.json({
      success: true,
      data: { 
        payments: payments || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/payments/student
 * @desc    Get student's payments
 * @access  Private (Student)
 */
router.get('/student', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get user profile to get user_id
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (profileError || !userProfile || userProfile.role !== 'student') {
      throw new AuthorizationError('Student access required');
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('due_date', { ascending: false });

    if (error) {
      throw new ValidationError('Failed to fetch payments');
    }

    res.json({
      success: true,
      data: { 
        payments: payments || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/payments/parent/:admissionNumber
 * @desc    Get child's payments (Parent access)
 * @access  Private (Parent)
 */
router.get('/parent/:admissionNumber', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    // Verify parent is linked to this admission number
    const { data: parentRecord, error: parentError } = await supabase
      .from('parents')
      .select('verified, user_profiles!inner(user_id)')
      .eq('user_id', req.user.id)
      .eq('user_profiles.admission_number', admissionNumber)
      .single();

    if (parentError || !parentRecord || !parentRecord.verified) {
      throw new AuthorizationError('Unauthorized access to child information');
    }

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', parentRecord.user_profiles.user_id)
      .order('due_date', { ascending: false });

    if (error) {
      throw new ValidationError('Failed to fetch payments');
    }

    res.json({
      success: true,
      data: { 
        payments: payments || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/payments
 * @desc    Create a new payment record
 * @access  Private (Admin)
 */
router.post('/', authMiddleware, adminMiddleware, [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('payment_type').notEmpty().withMessage('Payment type is required')
], asyncHandler(async (req, res) => {
  const baseValidation = validationResult(req);
  if (!baseValidation.isEmpty()) {
    throw new ValidationError('Validation failed', baseValidation.array());
  }

  let { user_id, amount, payment_type, due_date, notes, payment_date, student_admission_number } = req.body;

  // Accept either due_date or payment_date
  if (!due_date && payment_date) {
    due_date = payment_date;
  }

  if (!due_date) {
    throw new ValidationError('Validation failed', [{ msg: 'Due date is required', param: 'due_date' }]);
  }

  // Normalize values
  const normalizeDate = (d) => {
    try {
      const iso = new Date(d);
      if (isNaN(iso.getTime())) return null;
      return iso.toISOString().split('T')[0];
    } catch (_) {
      return null;
    }
  };
  const normalizedDue = normalizeDate(due_date);
  if (!normalizedDue) {
    throw new ValidationError('Validation failed', [{ msg: 'Invalid due date', param: 'due_date' }]);
  }
  due_date = normalizedDue;
  amount = parseFloat(amount);

  // If user_id not provided, resolve via admission number
  if (!user_id) {
    if (!student_admission_number) {
      throw new ValidationError('Validation failed', [{ msg: 'Either user_id or student_admission_number is required', param: 'user_id' }]);
    }
    // Try lookup by username (student username == admission number)
    let { data: studentUser, error: studentErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', String(student_admission_number))
      .single();

    // Fallback: some records keep the admission number in linked_admission_number
    if (studentErr || !studentUser) {
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('id')
        .eq('linked_admission_number', String(student_admission_number))
        .single();
      studentUser = fallbackUser;
    }

    if (!studentUser) {
      // As a last resort, look in admission_registry -> users by student_email
      const { data: registry } = await supabase
        .from('admission_registry')
        .select('student_email')
        .eq('admission_number', String(student_admission_number))
        .single();
      if (registry && registry.student_email) {
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', registry.student_email)
          .single();
        if (userByEmail) studentUser = userByEmail;
      }
      if (!studentUser) {
        throw new ValidationError('Student not found for admission number');
      }
    }
    user_id = studentUser.id;
  }

  try {
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id,
        amount,
        payment_type,
        due_date,
        notes: notes || null,
        status: 'pending',
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) {
      // Surface underlying database error for easier debugging
      throw new ValidationError(error.message || 'Failed to create payment record');
    }

    res.status(201).json({
      success: true,
      data: {
        payment,
        message: 'Payment record created successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/payments/:id/pay
 * @desc    Mark payment as paid (by student or parent)
 * @access  Private (Student or Parent)
 */
router.put('/:id/pay', authMiddleware, [
  body('payment_method').notEmpty().withMessage('Payment method is required'),
  body('transaction_reference').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { payment_method, transaction_reference, paid_by_role } = req.body;

  try {
    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, users!payments_user_id_fkey(*)')
      .eq('id', id)
      .single();

    if (paymentError || !payment) {
      throw new ValidationError('Payment record not found');
    }

    if (payment.status === 'paid') {
      throw new ValidationError('Payment already marked as paid');
    }

    // Check if user has permission to pay this
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userProfile) {
      throw new AuthorizationError('User not found');
    }

    // Allow student to pay their own payment
    let canPay = userProfile.id === payment.user_id && userProfile.role === 'student';

    // Allow parent to pay if they're verified and linked to the student
    if (!canPay && userProfile.role === 'parent') {
      const { data: parentRecord, error: parentError } = await supabase
        .from('parents')
        .select('verified, user_profiles!inner(user_id)')
        .eq('user_id', userProfile.id)
        .eq('user_profiles.user_id', payment.user_id)
        .single();

      canPay = !parentError && parentRecord && parentRecord.verified;
    }

    if (!canPay) {
      throw new AuthorizationError('You are not authorized to pay this amount');
    }

    // Update payment as paid
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        payment_method,
        transaction_reference: transaction_reference || null,
        paid_at: new Date().toISOString(),
        paid_by: userProfile.id,
        paid_by_role: paid_by_role || userProfile.role
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new ValidationError('Failed to update payment');
    }

    res.json({
      success: true,
      data: {
        payment: updatedPayment,
        message: 'Payment marked as paid successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/payments/:id/status
 * @desc    Update payment status (Admin only)
 * @access  Private (Admin)
 */
router.put('/:id/status', authMiddleware, adminMiddleware, [
  body('status').isIn(['pending', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        status,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new ValidationError('Failed to update payment status');
    }

    res.json({
      success: true,
      data: {
        payment,
        message: 'Payment status updated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;