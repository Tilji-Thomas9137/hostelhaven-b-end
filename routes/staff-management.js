const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role only
const adminOnlyMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin access required');
  }
};

/**
 * @route   GET /api/staff-management/staff
 * @desc    Get all staff members (warden, assistant)
 * @access  Private (Admin only)
 */
router.get('/staff', authMiddleware, adminOnlyMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select(`
        id,
        auth_uid,
        full_name,
        email,
        phone,
        role,
        status,
        username,
        created_at,
        updated_at
      `)
      .in('role', ['warden', 'hostel_operations_assistant'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch staff: ${error.message}`);
    }

    res.json({
      success: true,
      data: { staff: staff || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/staff-management/staff
 * @desc    Create new staff member (warden or assistant)
 * @access  Private (Admin only)
 */
router.post('/staff', authMiddleware, adminOnlyMiddleware, [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('role').isIn(['warden', 'hostel_operations_assistant']).withMessage('Role must be warden or hostel_operations_assistant'),
  body('employee_id').notEmpty().withMessage('Employee ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { full_name, email, phone, role, employee_id } = req.body;

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Generate activation token + OTP and create user in pending state
    const { generateActivationToken, generateOtpCode, getExpiryFromNowMinutes, getExpiryFromNowHours } = require('../utils/security');
    const { sendActivationEmailHybrid } = require('../utils/hybrid-mailer');

    const activation_token = generateActivationToken();
    const activation_expires_at = getExpiryFromNowHours(24);
    const otp_code = generateOtpCode();
    const otp_expires_at = getExpiryFromNowMinutes(10);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        full_name,
        phone,
        role,
        username: employee_id,
        // "users.status" constraint allows only 'active' | 'inactive' | 'suspended'
        status: 'inactive',
        // satisfy NOT NULL until activation flow sets a real auth password
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        activation_token,
        activation_expires_at,
        otp_code,
        otp_expires_at
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create user profile: ${userError.message}`);
    }

    // Send activation email
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=${activation_token}`;
      await sendActivationEmailHybrid({
        to: email,
        fullName: full_name,
        username: employee_id,
        activationLink,
        otpCode: otp_code
      });
    } catch (mailError) {
      console.warn('Failed to send activation email:', mailError.message);
    }

    res.status(201).json({
      success: true,
      data: { 
        user: newUser,
        message: 'Staff member created. Activation email sent with OTP.'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/staff-management/staff/:id
 * @desc    Update staff member
 * @access  Private (Admin only)
 */
router.put('/staff/:id', authMiddleware, adminOnlyMiddleware, [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('role').optional().isIn(['warden', 'hostel_operations_assistant']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  try {
    // Check if user exists and is staff
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role, auth_uid')
      .eq('id', id)
      .in('role', ['warden', 'hostel_operations_assistant'])
      .single();

    if (fetchError || !existingUser) {
      throw new ValidationError('Staff member not found');
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update staff member: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: { 
        user: updatedUser,
        message: 'Staff member updated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   DELETE /api/staff-management/staff/:id
 * @desc    Deactivate staff member (soft delete)
 * @access  Private (Admin only)
 */
router.delete('/staff/:id', authMiddleware, adminOnlyMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user exists and is staff
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role, auth_uid')
      .eq('id', id)
      .in('role', ['warden', 'hostel_operations_assistant'])
      .single();

    if (fetchError || !existingUser) {
      throw new ValidationError('Staff member not found');
    }

    // Hard delete the staff user record
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete staff member: ${deleteError.message}`);
    }

    // Also remove the Supabase Auth user if present
    if (existingUser.auth_uid) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(existingUser.auth_uid);
      } catch (authDeleteError) {
        console.warn(`Failed to delete auth user ${existingUser.auth_uid}:`, authDeleteError.message);
      }
    }

    res.json({
      success: true,
      data: { message: 'Staff member deleted successfully' }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
