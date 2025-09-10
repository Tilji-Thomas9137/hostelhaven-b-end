const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/leave-requests/summary
 * @desc    Get leave requests summary for dashboard
 * @access  Private
 */
router.get('/summary', authMiddleware, asyncHandler(async (req, res) => {
  const { data: leaveRequests, error } = await supabase
    .from('leave_requests')
    .select('status, start_date, end_date, created_at')
    .eq('user_id', req.user.id);

  if (error) {
    throw new ValidationError('Failed to fetch leave requests summary');
  }

  const summary = {
    total: leaveRequests.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    upcoming: 0,
    active: 0
  };

  const today = new Date().toISOString().split('T')[0];

  leaveRequests.forEach(request => {
    summary[request.status] = (summary[request.status] || 0) + 1;
    
    if (request.status === 'approved') {
      if (request.start_date > today) {
        summary.upcoming++;
      } else if (request.start_date <= today && request.end_date >= today) {
        summary.active++;
      }
    }
  });

  res.json({
    success: true,
    data: { summary }
  });
}));

/**
 * @route   GET /api/leave-requests
 * @desc    Get user's leave requests
 * @access  Private
 */
router.get('/', authMiddleware, [
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  // First ensure user exists in our database
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', req.user.id)
    .single();

  if (userError) {
    console.error('User fetch error:', userError);
    // Create user profile if it doesn't exist
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: req.user.id,
        email: req.user.email,
        full_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
        role: 'student'
      })
      .select()
      .single();

    if (createError) {
      console.error('User creation error:', createError);
      throw new ValidationError('Failed to create user profile');
    }
  }

  const { status, limit = 10, offset = 0 } = req.query;
  
  let query = supabase
    .from('leave_requests')
    .select(`
      *,
      rooms(room_number, floor),
      approved_by_user:users!leave_requests_approved_by_fkey(full_name, role)
    `)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: leaveRequests, error } = await query;

  if (error) {
    console.error('Leave requests fetch error:', error);
    // If it's a permission error, return empty array
    if (error.code === 'PGRST301') {
      return res.json({
        success: true,
        data: {
          leaveRequests: [],
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: 0
          }
        }
      });
    }
    throw new ValidationError('Failed to fetch leave requests');
  }

  res.json({
    success: true,
    data: {
      leaveRequests,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: leaveRequests.length
      }
    }
  });
}));

/**
 * @route   GET /api/leave-requests/:id
 * @desc    Get specific leave request details
 * @access  Private
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: leaveRequest, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      rooms(room_number, floor, room_type),
      approved_by_user:users!leave_requests_approved_by_fkey(full_name, role, email)
    `)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !leaveRequest) {
    throw new ValidationError('Leave request not found');
  }

  res.json({
    success: true,
    data: { leaveRequest }
  });
}));

/**
 * @route   POST /api/leave-requests
 * @desc    Create new leave request
 * @access  Private
 */
router.post('/', authMiddleware, [
  body('reason').trim().isLength({ min: 5, max: 255 }).withMessage('Reason must be between 5 and 255 characters'),
  body('destination').trim().isLength({ min: 2, max: 255 }).withMessage('Destination must be between 2 and 255 characters'),
  body('start_date').isISO8601().withMessage('Start date must be a valid date'),
  body('end_date').isISO8601().withMessage('End date must be a valid date'),
  body('emergency_contact').optional().trim().isLength({ min: 2, max: 255 }),
  body('emergency_phone').optional().isMobilePhone('any')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { reason, destination, start_date, end_date, emergency_contact, emergency_phone } = req.body;

  // Validate date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate < today) {
    throw new ValidationError('Start date cannot be in the past');
  }

  if (endDate < startDate) {
    throw new ValidationError('End date cannot be before start date');
  }

  // Check for overlapping leave requests: start_date <= new end AND end_date >= new start
  const { data: overlapping, error: overlapError } = await supabase
    .from('leave_requests')
    .select('id')
    .eq('user_id', req.user.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', end_date)
    .gte('end_date', start_date);

  if (overlapError) {
    throw new ValidationError('Failed to check for overlapping requests');
  }

  if (overlapping && overlapping.length > 0) {
    throw new ValidationError('You have an overlapping leave request for this period');
  }

  // Get user's hostel and room info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('hostel_id, room_id')
    .eq('id', req.user.id)
    .single();

  if (userError) {
    throw new ValidationError('Failed to get user information');
  }

  const { data: leaveRequest, error } = await supabase
    .from('leave_requests')
    .insert({
      user_id: req.user.id,
      hostel_id: user.hostel_id,
      room_id: user.room_id,
      reason,
      destination,
      start_date,
      end_date,
      emergency_contact,
      emergency_phone,
      status: 'pending'
    })
    .select(`
      *,
      rooms(room_number, floor)
    `)
    .single();

  if (error) {
    throw new ValidationError('Failed to create leave request');
  }

  // Create notification for hostel staff
  if (user.hostel_id) {
    const { data: staff } = await supabase
      .from('users')
      .select('id')
      .eq('hostel_id', user.hostel_id)
      .in('role', ['warden', 'hostel_operations_assistant']);

    if (staff && staff.length > 0) {
      const notifications = staff.map(staffMember => ({
        user_id: staffMember.id,
        title: 'New Leave Request',
        message: `A new leave request has been submitted from ${start_date} to ${end_date}`,
        type: 'leave'
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    }
  }

  // Also notify all admins
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin');

  if (admins && admins.length > 0) {
    const adminNotifications = admins.map(admin => ({
      user_id: admin.id,
      title: 'New Leave Request',
      message: `A new leave request has been submitted from ${start_date} to ${end_date}`,
      type: 'leave'
    }));

    await supabase
      .from('notifications')
      .insert(adminNotifications);
  }

  res.status(201).json({
    success: true,
    message: 'Leave request submitted successfully',
    data: { leaveRequest }
  });
}));

/**
 * @route   PUT /api/leave-requests/:id
 * @desc    Update leave request (only if pending)
 * @access  Private
 */
router.put('/:id', authMiddleware, [
  body('reason').optional().trim().isLength({ min: 5, max: 255 }),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('emergency_contact').optional().trim().isLength({ min: 2, max: 255 }),
  body('emergency_phone').optional().isMobilePhone()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { reason, start_date, end_date, emergency_contact, emergency_phone } = req.body;

  // Check if leave request exists and belongs to user
  const { data: existingRequest, error: fetchError } = await supabase
    .from('leave_requests')
    .select('status, start_date, end_date')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !existingRequest) {
    throw new ValidationError('Leave request not found');
  }

  if (existingRequest.status !== 'pending') {
    throw new ValidationError('Cannot update leave request that has already been processed');
  }

  // Validate date range if dates are being updated
  if (start_date || end_date) {
    const startDate = new Date(start_date || existingRequest.start_date);
    const endDate = new Date(end_date || existingRequest.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      throw new ValidationError('Start date cannot be in the past');
    }

    if (endDate < startDate) {
      throw new ValidationError('End date cannot be before start date');
    }

    // Check for overlapping leave requests (excluding current one)
    const { data: overlapping, error: overlapError } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('user_id', req.user.id)
      .neq('id', id)
      .in('status', ['pending', 'approved'])
      .or(`start_date.lte.${endDate.toISOString().split('T')[0]},end_date.gte.${startDate.toISOString().split('T')[0]}`);

    if (overlapError) {
      throw new ValidationError('Failed to check for overlapping requests');
    }

    if (overlapping && overlapping.length > 0) {
      throw new ValidationError('You have an overlapping leave request for this period');
    }
  }

  const updates = {};
  if (reason) updates.reason = reason;
  if (start_date) updates.start_date = start_date;
  if (end_date) updates.end_date = end_date;
  if (emergency_contact) updates.emergency_contact = emergency_contact;
  if (emergency_phone) updates.emergency_phone = emergency_phone;

  const { data: leaveRequest, error } = await supabase
    .from('leave_requests')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      hostels(name, city),
      rooms(room_number, floor)
    `)
    .single();

  if (error) {
    throw new ValidationError('Failed to update leave request');
  }

  res.json({
    success: true,
    message: 'Leave request updated successfully',
    data: { leaveRequest }
  });
}));

/**
 * @route   DELETE /api/leave-requests/:id
 * @desc    Delete leave request (only if pending)
 * @access  Private
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if leave request exists and belongs to user
  const { data: existingRequest, error: fetchError } = await supabase
    .from('leave_requests')
    .select('status')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !existingRequest) {
    throw new ValidationError('Leave request not found');
  }

  if (existingRequest.status !== 'pending') {
    throw new ValidationError('Cannot delete leave request that has already been processed');
  }

  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id);

  if (error) {
    throw new ValidationError('Failed to delete leave request');
  }

  res.json({
    success: true,
    message: 'Leave request deleted successfully'
  });
}));

module.exports = router;