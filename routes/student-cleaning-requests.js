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
 * @route   GET /api/student-cleaning-requests/all
 * @desc    Get all cleaning requests (hostel operations assistant view)
 * @access  Private (Hostel Operations Assistant)
 */
router.get('/all', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Check if user has hostel operations assistant access
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'hostel_operations_assistant') {
      throw new ValidationError('Hostel operations assistant access required');
    }

    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Build query without foreign key relationships to avoid schema cache issues
    let query = supabase
      .from('cleaning_requests')
      .select(`
        id,
        student_id,
        room_id,
        cleaning_type,
        preferred_date,
        preferred_time,
        special_instructions,
        status,
        created_at,
        updated_at,
        assigned_to,
        notes
      `)
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch cleaning requests: ${error.message}`);
    }

    // Manually fetch room and user profile data for each request
    const enrichedRequests = [];
    if (requests && requests.length > 0) {
      for (const request of requests) {
        // Fetch room details
        let roomDetails = null;
        if (request.room_id) {
          const { data: roomData } = await supabase
            .from('rooms')
            .select('room_number, floor, room_type, capacity')
            .eq('id', request.room_id)
            .single();
          roomDetails = roomData;
        }

        // Fetch user profile details
        let userProfile = null;
        if (request.student_id) {
          // First try to get user info from users table
          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name, email, phone, auth_uid')
            .eq('id', request.student_id)
            .single();
          
          if (userData) {
            // Then get profile data from user_profiles table
            const { data: profileData } = await supabase
              .from('user_profiles')
              .select('full_name, admission_number, email, phone_number, course, batch_year')
              .eq('user_id', request.student_id)
              .single();
            
            // Combine user data with profile data, prioritizing profile data
            userProfile = {
              full_name: profileData?.full_name || userData.full_name || 'Unknown',
              admission_number: profileData?.admission_number || 'N/A',
              email: profileData?.email || userData.email || 'N/A',
              phone_number: profileData?.phone_number || userData.phone || 'N/A',
              course: profileData?.course || 'N/A',
              batch_year: profileData?.batch_year || 'N/A'
            };
          }
        }

        enrichedRequests.push({
          ...request,
          rooms: roomDetails,
          user_profiles: userProfile
        });
      }
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: {
        requests: enrichedRequests || [],
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

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
 * @route   PUT /api/student-cleaning-requests/:id/approve
 * @desc    Approve a cleaning request (hostel operations assistant only)
 * @access  Private (Hostel Operations Assistant)
 */
router.put('/:id/approve', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to, notes } = req.body;

    // Check if user has hostel operations assistant access
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'hostel_operations_assistant') {
      throw new ValidationError('Hostel operations assistant access required');
    }

    // Get the cleaning request
    const { data: request, error: fetchError } = await supabase
      .from('cleaning_requests')
      .select(`
        *,
        rooms!cleaning_requests_room_id_fkey(room_number, floor),
        user_profiles!cleaning_requests_student_id_fkey(full_name, admission_number)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be approved');
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('cleaning_requests')
      .update({ 
        status: 'approved',
        assigned_to: assigned_to || null,
        notes: notes || 'Request approved by staff',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error approving cleaning request:', updateError);
      throw new ValidationError('Failed to approve cleaning request');
    }

    // Send notification to student
    try {
      await supabase.from('notifications').insert({
        user_id: request.student_id,
        type: 'cleaning_request_approved',
        title: 'Cleaning Request Approved',
        message: `Your ${request.cleaning_type} cleaning request for Room ${request.rooms?.room_number} has been approved.`,
        metadata: {
          request_id: id,
          cleaning_type: request.cleaning_type,
          preferred_date: request.preferred_date,
          preferred_time: request.preferred_time
        },
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      message: 'Cleaning request approved successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/student-cleaning-requests/:id/reject
 * @desc    Reject a cleaning request (hostel operations assistant only)
 * @access  Private (Hostel Operations Assistant)
 */
router.put('/:id/reject', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Check if user has hostel operations assistant access
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'hostel_operations_assistant') {
      throw new ValidationError('Hostel operations assistant access required');
    }

    // Get the cleaning request
    const { data: request, error: fetchError } = await supabase
      .from('cleaning_requests')
      .select(`
        *,
        rooms!cleaning_requests_room_id_fkey(room_number, floor)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be rejected');
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('cleaning_requests')
      .update({ 
        status: 'cancelled',
        notes: reason || 'Request rejected by staff',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error rejecting cleaning request:', updateError);
      throw new ValidationError('Failed to reject cleaning request');
    }

    // Send notification to student
    try {
      await supabase.from('notifications').insert({
        user_id: request.student_id,
        type: 'cleaning_request_rejected',
        title: 'Cleaning Request Rejected',
        message: `Your ${request.cleaning_type} cleaning request for Room ${request.rooms?.room_number} has been rejected. ${reason ? 'Reason: ' + reason : ''}`,
        metadata: {
          request_id: id,
          cleaning_type: request.cleaning_type,
          reason: reason
        },
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      message: 'Cleaning request rejected successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/student-cleaning-requests/:id/update-status
 * @desc    Update cleaning request status (hostel operations assistant only)
 * @access  Private (Hostel Operations Assistant)
 */
router.put('/:id/update-status', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Check if user has hostel operations assistant access
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'hostel_operations_assistant') {
      throw new ValidationError('Hostel operations assistant access required');
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status');
    }

    // Get the cleaning request
    const { data: request, error: fetchError } = await supabase
      .from('cleaning_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    // Update the request status
    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('cleaning_requests')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating cleaning request status:', updateError);
      throw new ValidationError('Failed to update cleaning request status');
    }

    res.json({
      success: true,
      message: `Cleaning request status updated to ${status} successfully!`
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

/**
 * @route   GET /api/student-cleaning-requests/admin/analytics
 * @desc    Get cleaning analytics and completed tasks (admin only)
 * @access  Private (Admin)
 */
router.get('/admin/analytics', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Check if user has admin access
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'admin') {
      throw new ValidationError('Admin access required');
    }

    const { start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Build query for completed tasks
    let query = supabase
      .from('cleaning_requests')
      .select(`
        id,
        student_id,
        room_id,
        cleaning_type,
        preferred_date,
        preferred_time,
        special_instructions,
        status,
        created_at,
        updated_at,
        completed_at,
        notes,
        rooms!cleaning_requests_room_id_fkey(
          room_number,
          floor
        ),
        user_profiles!cleaning_requests_student_id_fkey(
          full_name,
          admission_number,
          email
        )
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    // Apply date filters if provided
    if (start_date) {
      query = query.gte('completed_at', start_date);
    }
    if (end_date) {
      query = query.lte('completed_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: completedTasks, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch completed tasks: ${error.message}`);
    }

    // Get analytics data
    const { data: allRequests, error: analyticsError } = await supabase
      .from('cleaning_requests')
      .select('status, cleaning_type, created_at, completed_at');

    if (analyticsError) {
      throw new Error(`Failed to fetch analytics: ${analyticsError.message}`);
    }

    // Calculate analytics
    const totalRequests = allRequests.length;
    const completedRequests = allRequests.filter(r => r.status === 'completed').length;
    const pendingRequests = allRequests.filter(r => r.status === 'pending').length;
    const inProgressRequests = allRequests.filter(r => r.status === 'in_progress').length;
    const cancelledRequests = allRequests.filter(r => r.status === 'cancelled').length;

    // Cleaning type distribution
    const cleaningTypeStats = allRequests.reduce((acc, request) => {
      acc[request.cleaning_type] = (acc[request.cleaning_type] || 0) + 1;
      return acc;
    }, {});

    // Monthly completion stats (last 12 months)
    const monthlyStats = allRequests
      .filter(r => r.completed_at)
      .reduce((acc, request) => {
        const month = new Date(request.completed_at).toISOString().slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

    // Average completion time
    const completionTimes = allRequests
      .filter(r => r.completed_at && r.created_at)
      .map(r => {
        const created = new Date(r.created_at);
        const completed = new Date(r.completed_at);
        return Math.round((completed - created) / (1000 * 60 * 60 * 24)); // days
      });

    const avgCompletionTime = completionTimes.length > 0 
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;

    // Get total count for pagination
    let countQuery = supabase
      .from('cleaning_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (start_date) {
      countQuery = countQuery.gte('completed_at', start_date);
    }
    if (end_date) {
      countQuery = countQuery.lte('completed_at', end_date);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: {
        completedTasks: completedTasks || [],
        analytics: {
          totalRequests,
          completedRequests,
          pendingRequests,
          inProgressRequests,
          cancelledRequests,
          completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
          avgCompletionTime,
          cleaningTypeStats,
          monthlyStats
        },
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
