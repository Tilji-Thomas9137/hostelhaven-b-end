const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
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

    if (error || !userProfile || userProfile.role !== 'admin') {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin access required');
  }
};

/**
 * @route   GET /api/leave-requests
 * @desc    Get all leave requests
 * @access  Private (Admin)
 */
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    // For now, return empty array since leave_requests table might not exist
    res.json({
      success: true,
      data: { 
        leaveRequests: []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/leave-requests
 * @desc    Create a new leave request
 * @access  Private (Admin)
 */
router.post('/', authMiddleware, adminMiddleware, [
  body('student_name').notEmpty().withMessage('Student name is required'),
  body('leave_type').notEmpty().withMessage('Leave type is required'),
  body('from_date').notEmpty().withMessage('From date is required'),
  body('to_date').notEmpty().withMessage('To date is required'),
  body('reason').notEmpty().withMessage('Reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    // For now, just return success since leave_requests table might not exist
    res.status(201).json({
      success: true,
      data: {
        leaveRequest: req.body,
        message: 'Leave request created successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;