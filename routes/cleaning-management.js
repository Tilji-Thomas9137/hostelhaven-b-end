const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check staff access (admin, warden, assistant)
const staffMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Staff access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Staff access required');
  }
};

// Middleware to check student access
const studentMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'student') {
      throw new AuthorizationError('Student access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Student access required');
  }
};

// Middleware to check operations assistant access
const operationsMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Operations access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Operations access required');
  }
};

/**
 * @route   POST /api/cleaning-management/requests
 * @desc    Student submits cleaning request
 * @access  Private (Student)
 */
router.post('/requests', authMiddleware, studentMiddleware, [
  body('cleaning_type').isIn(['room', 'bathroom', 'common_area', 'other']).withMessage('Invalid cleaning type'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('description').notEmpty().withMessage('Description is required'),
  body('preferred_time').optional().isISO8601().withMessage('Invalid preferred time format')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { cleaning_type, priority, description, preferred_time } = req.body;

  try {
    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id, full_name, room_id')
      .eq('auth_uid', req.user.id)
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student profile not found');
    }

    if (!student.room_id) {
      throw new ValidationError('You must have a room allocation to submit cleaning requests');
    }

    // Check if student has pending cleaning request
    const { data: existingRequest, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id')
      .eq('student_id', student.id)
      .in('status', ['pending', 'assigned', 'in_progress'])
      .single();

    if (existingRequest) {
      throw new ValidationError('You already have a pending cleaning request');
    }

    // Create cleaning request
    const { data: newRequest, error: createError } = await supabase
      .from('cleaning_requests')
      .insert({
        student_id: student.id,
        room_id: student.room_id,
        cleaning_type,
        priority,
        description,
        preferred_time: preferred_time || null,
        status: 'pending',
        requested_at: new Date().toISOString()
      })
      .select(`
        id,
        cleaning_type,
        priority,
        description,
        preferred_time,
        status,
        requested_at,
        rooms!cleaning_requests_room_id_fkey(
          room_number,
          floor
        )
      `)
      .single();

    if (createError) {
      throw new Error(`Failed to create cleaning request: ${createError.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        request: newRequest,
        message: 'Cleaning request submitted successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/cleaning-management/requests/my-requests
 * @desc    Get student's own cleaning requests
 * @access  Private (Student)
 */
router.get('/requests/my-requests', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student profile not found');
    }

    // Get student's cleaning requests
    const { data: requests, error } = await supabase
      .from('cleaning_requests')
      .select(`
        id,
        cleaning_type,
        priority,
        description,
        preferred_time,
        status,
        requested_at,
        assigned_at,
        completed_at,
        assigned_to,
        notes,
        rooms!cleaning_requests_room_id_fkey(
          room_number,
          floor
        ),
        cleaning_staff!cleaning_requests_assigned_to_fkey(
          full_name
        )
      `)
      .eq('student_id', student.id)
      .order('requested_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch cleaning requests: ${error.message}`);
    }

    res.json({
      success: true,
      data: { requests: requests || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/cleaning-management/requests
 * @desc    Get all cleaning requests (staff view)
 * @access  Private (Staff)
 */
router.get('/requests', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('cleaning_requests')
      .select(`
        id,
        student_id,
        room_id,
        cleaning_type,
        priority,
        description,
        preferred_time,
        status,
        requested_at,
        assigned_at,
        completed_at,
        assigned_to,
        notes,
        user_profiles!cleaning_requests_student_id_fkey(
          full_name,
          admission_number
        ),
        rooms!cleaning_requests_room_id_fkey(
          room_number,
          floor
        ),
        cleaning_staff!cleaning_requests_assigned_to_fkey(
          full_name
        )
      `)
      .order('requested_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch cleaning requests: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (priority) {
      countQuery = countQuery.eq('priority', priority);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: { 
        requests: requests || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-management/requests/:id/assign
 * @desc    Assign cleaning request to staff member
 * @access  Private (Operations Assistant)
 */
router.put('/requests/:id/assign', authMiddleware, operationsMiddleware, [
  body('assigned_to').isUUID().withMessage('Valid staff ID is required'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { assigned_to, notes } = req.body;

  try {
    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    // Get cleaning request
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Request is not pending and cannot be assigned');
    }

    // Verify assigned staff member exists and is cleaning staff
    const { data: assignedStaff, error: staffCheckError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('id', assigned_to)
      .single();

    if (staffCheckError || !assignedStaff) {
      throw new ValidationError('Assigned staff member not found');
    }

    if (!['admin', 'hostel_operations_assistant'].includes(assignedStaff.role)) {
      throw new ValidationError('Assigned person is not authorized for cleaning tasks');
    }

    // Update request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update({
        status: 'assigned',
        assigned_to,
        assigned_at: new Date().toISOString(),
        notes: notes || null
      })
      .eq('id', id)
      .select(`
        id,
        status,
        assigned_to,
        assigned_at,
        notes,
        cleaning_staff!cleaning_requests_assigned_to_fkey(
          full_name
        )
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to assign cleaning request: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        request: updatedRequest,
        message: 'Cleaning request assigned successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-management/requests/:id/status
 * @desc    Update cleaning request status
 * @access  Private (Operations Assistant)
 */
router.put('/requests/:id/status', authMiddleware, operationsMiddleware, [
  body('status').isIn(['in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    // Get cleaning request
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status, assigned_to')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    // Validate status transition
    const validTransitions = {
      'assigned': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'pending': ['cancelled']
    };

    if (!validTransitions[request.status]?.includes(status)) {
      throw new ValidationError(`Invalid status transition from ${request.status} to ${status}`);
    }

    // Update request status
    const updateData = {
      status,
      notes: notes || null
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        status,
        assigned_at,
        completed_at,
        notes,
        cleaning_staff!cleaning_requests_assigned_to_fkey(
          full_name
        )
      `)
      .single();

    if (updateError) {
      throw new Error(`Failed to update cleaning request: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        request: updatedRequest,
        message: `Cleaning request ${status} successfully`
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/cleaning-management/staff
 * @desc    Get available cleaning staff
 * @access  Private (Operations Assistant)
 */
router.get('/staff', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('role', ['admin', 'hostel_operations_assistant'])
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch cleaning staff: ${error.message}`);
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
 * @route   GET /api/cleaning-management/stats
 * @desc    Get cleaning statistics for dashboard
 * @access  Private (Staff)
 */
router.get('/stats', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get cleaning request counts by status
    const { count: totalRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true });

    const { count: pendingRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: inProgressRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    const { count: completedRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Get today's requests
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: todayRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .gte('requested_at', today.toISOString())
      .lt('requested_at', tomorrow.toISOString());

    // Get priority breakdown
    const { count: urgentRequests } = await supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .in('status', ['pending', 'assigned', 'in_progress']);

    res.json({
      success: true,
      data: {
        total_requests: totalRequests || 0,
        pending_requests: pendingRequests || 0,
        in_progress_requests: inProgressRequests || 0,
        completed_requests: completedRequests || 0,
        today_requests: todayRequests || 0,
        urgent_requests: urgentRequests || 0
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/cleaning-management/schedule
 * @desc    Get cleaning schedule for operations dashboard
 * @access  Private (Operations Assistant)
 */
router.get('/schedule', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  try {
    const { date, status } = req.query;

    let query = supabase
      .from('cleaning_requests')
      .select(`
        id,
        cleaning_type,
        priority,
        description,
        preferred_time,
        status,
        requested_at,
        assigned_at,
        completed_at,
        user_profiles!cleaning_requests_student_id_fkey(
          full_name
        ),
        rooms!cleaning_requests_room_id_fkey(
          room_number,
          floor
        ),
        cleaning_staff!cleaning_requests_assigned_to_fkey(
          full_name
        )
      `)
      .order('preferred_time', { ascending: true, nullsFirst: true });

    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      query = query
        .gte('preferred_time', startDate.toISOString())
        .lt('preferred_time', endDate.toISOString());
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: schedule, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch cleaning schedule: ${error.message}`);
    }

    res.json({
      success: true,
      data: { schedule: schedule || [] }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
