const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check student access
const studentMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'student') {
      throw new AuthorizationError('Student access required');
    }

    if (userProfile.status === 'inactive' || userProfile.status === 'suspended') {
      throw new AuthorizationError('Your account is currently inactive. Please contact an administrator to activate your account.');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Student access required');
  }
};

/**
 * @route   GET /api/student-leave-requests
 * @desc    Get student's leave requests
 * @access  Private (Student)
 */
router.get('/', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get user's ID
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Fetch leave requests for the user
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userRow.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leave requests:', error);
      throw new ValidationError('Failed to fetch leave requests');
    }

    res.json({
      success: true,
      data: { 
        leaveRequests: requests || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/student-leave-requests
 * @desc    Create a new leave request
 * @access  Private (Student)
 */
router.post('/', authMiddleware, studentMiddleware, [
  body('leave_type').isIn(['emergency', 'medical', 'personal', 'family', 'academic']).withMessage('Invalid leave type'),
  body('from_date').isISO8601().withMessage('Invalid from date format'),
  body('to_date').isISO8601().withMessage('Invalid to date format'),
  body('reason').isString().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  body('destination').optional().isString().withMessage('Destination must be a string')
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const { leave_type, from_date, to_date, reason, destination } = req.body;

    // Validate date range
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (fromDate < today) {
      throw new ValidationError('Leave start date cannot be in the past');
    }

    if (toDate <= fromDate) {
      throw new ValidationError('Leave end date must be after start date');
    }

    // Check if leave duration is reasonable (max 30 days)
    const diffTime = Math.abs(toDate - fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      throw new ValidationError('Leave duration cannot exceed 30 days');
    }

    // Get user's ID and profile
    const { data: userRow } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      throw new ValidationError('You already have a pending leave request.');
    }

    // Create the leave request
    const { data: request, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: userRow.id,
        student_name: userRow.full_name,
        student_email: userRow.email,
        leave_type,
        from_date,
        to_date,
        reason,
        destination: destination || '',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating leave request:', error);
      throw new ValidationError('Failed to create leave request');
    }

    // Notify staff about the new request
    try {
      const { data: staffList } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['admin', 'warden', 'hostel_operations_assistant']);

      const notifications = (staffList || []).map((staffUser) => ({
        user_id: staffUser.id,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${userRow.full_name} has submitted a ${leave_type} leave request for ${diffDays} days.`,
        metadata: {
          request_id: request.id,
          student_id: userRow.id,
          leave_type,
          from_date,
          to_date,
          duration: diffDays
        },
        is_read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      data: { request },
      message: 'Leave request submitted successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/student-leave-requests/:id/cancel
 * @desc    Cancel a leave request
 * @access  Private (Student)
 */
router.put('/:id/cancel', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's ID
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Check if the request exists and belongs to the user
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', userRow.id)
      .single();

    if (fetchError || !request) {
      throw new ValidationError('Leave request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be cancelled');
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error cancelling leave request:', updateError);
      throw new ValidationError('Failed to cancel leave request');
    }

    res.json({
      success: true,
      message: 'Leave request cancelled successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
