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
 * @route   GET /api/student-cleaning-requests
 * @desc    Get student's cleaning requests
 * @access  Private (Student)
 */
router.get('/', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get user's room allocation first
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Get user's room allocation
    const { data: roomAllocation } = await supabase
      .from('room_allocations')
      .select('room_id')
      .eq('user_id', userRow.id)
      .eq('allocation_status', 'active')
      .single();

    if (!roomAllocation) {
      return res.json({
        success: true,
        data: { 
          cleaningRequests: []
        }
      });
    }

    // Fetch cleaning requests for the user's room
    const { data: requests, error } = await supabase
      .from('cleaning_requests')
      .select('*')
      .eq('room_id', roomAllocation.room_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cleaning requests:', error);
      throw new ValidationError('Failed to fetch cleaning requests');
    }

    res.json({
      success: true,
      data: { 
        cleaningRequests: requests || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/student-cleaning-requests
 * @desc    Create a new cleaning request
 * @access  Private (Student)
 */
router.post('/', authMiddleware, studentMiddleware, [
  body('cleaning_type').isIn(['general', 'deep', 'window', 'bathroom']).withMessage('Invalid cleaning type'),
  body('preferred_date').isISO8601().withMessage('Invalid date format'),
  body('preferred_time').isIn(['morning', 'afternoon', 'evening']).withMessage('Invalid time slot'),
  body('special_instructions').optional().isString().withMessage('Special instructions must be a string')
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const { cleaning_type, preferred_date, preferred_time, special_instructions } = req.body;

    // Get user's room allocation
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    const { data: roomAllocation } = await supabase
      .from('room_allocations')
      .select('room_id')
      .eq('user_id', userRow.id)
      .eq('allocation_status', 'active')
      .single();

    if (!roomAllocation) {
      throw new ValidationError('No room allocation found. Please contact hostel administration.');
    }

    // Check if there's already a pending request for this room
    const { data: existingRequest } = await supabase
      .from('cleaning_requests')
      .select('id')
      .eq('room_id', roomAllocation.room_id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      throw new ValidationError('You already have a pending cleaning request for this room.');
    }

    // Create the cleaning request
    const { data: request, error } = await supabase
      .from('cleaning_requests')
      .insert({
        room_id: roomAllocation.room_id,
        student_id: userRow.id,
        preferred_date,
        preferred_time,
        cleaning_type,
        special_instructions: special_instructions || '',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating cleaning request:', error);
      throw new ValidationError('Failed to create cleaning request');
    }

    // Notify staff about the new request
    try {
      const { data: staffList } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['admin', 'warden', 'hostel_operations_assistant']);

      const notifications = (staffList || []).map((staffUser) => ({
        user_id: staffUser.id,
        type: 'cleaning_request',
        title: 'New Cleaning Request',
        message: `A new ${cleaning_type} cleaning request has been submitted for room ${roomAllocation.room_id}.`,
        metadata: {
          request_id: request.id,
          room_id: roomAllocation.room_id,
          cleaning_type,
          preferred_date,
          preferred_time
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
      message: 'Cleaning request submitted successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/student-cleaning-requests/:id/cancel
 * @desc    Cancel a cleaning request
 * @access  Private (Student)
 */
router.put('/:id/cancel', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's room allocation
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    const { data: roomAllocation } = await supabase
      .from('room_allocations')
      .select('room_id')
      .eq('user_id', userRow.id)
      .eq('allocation_status', 'active')
      .single();

    if (!roomAllocation) {
      throw new ValidationError('No room allocation found.');
    }

    // Check if the request exists and belongs to the user's room
    const { data: request, error: fetchError } = await supabase
      .from('cleaning_requests')
      .select('*')
      .eq('id', id)
      .eq('room_id', roomAllocation.room_id)
      .single();

    if (fetchError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be cancelled');
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('cleaning_requests')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error cancelling cleaning request:', updateError);
      throw new ValidationError('Failed to cancel cleaning request');
    }

    res.json({
      success: true,
      message: 'Cleaning request cancelled successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
