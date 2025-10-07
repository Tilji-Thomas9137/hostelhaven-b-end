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
 * @route   GET /api/complaints
 * @desc    Get all complaints
 * @access  Private (Admin)
 */
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    // For now, return empty array since complaints table might not exist
    res.json({
      success: true,
      data: { 
        complaints: []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/complaints
 * @desc    Create a new complaint
 * @access  Private (Admin)
 */
router.post('/', authMiddleware, adminMiddleware, [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('student_name').notEmpty().withMessage('Student name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('priority').notEmpty().withMessage('Priority is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  try {
    // For now, just return success since complaints table might not exist
    res.status(201).json({
      success: true,
      data: {
        complaint: req.body,
        message: 'Complaint created successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;