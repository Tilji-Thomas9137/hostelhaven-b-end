const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');
const { ValidationError, AuthenticationError, AuthorizationError } = require('../middleware/errorHandler');

// Middleware to check staff access (admin, warden, assistant)
const staffMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile) {
      throw new AuthorizationError('User profile not found');
    }

    // Check if user has staff access
    if (!['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Staff access required');
    }

    // Check if user account is active
    if (userProfile.status !== 'active') {
      throw new AuthorizationError('Account is not active');
    }

    req.userProfile = userProfile;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/cleaning-requests/simple-test
 * @desc    Simple test endpoint to check data without authentication
 * @access  Public (for debugging)
 */
router.get('/simple-test', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 SIMPLE TEST: Checking cleaning requests data...');
    
    // Get cleaning requests
    const { data: requests, error: requestsError } = await supabase
      .from('cleaning_requests')
      .select('id, student_id, cleaning_type, status')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (requestsError) {
      return res.json({ success: false, error: requestsError.message });
    }
    
    console.log('🔍 SIMPLE TEST: Found requests:', requests?.length || 0);
    
    // For each request, get user data
    const results = [];
    for (const request of requests || []) {
      console.log('🔍 SIMPLE TEST: Processing request:', request.id, 'student_id:', request.student_id);
      
      // Get student data - full_name as student name and username as admission number
      let userData = null;
      if (request.student_id) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email, username, role')
          .eq('id', request.student_id)
          .eq('role', 'student')
          .single();
        
        if (userError) {
          console.error('❌ SIMPLE TEST: Student error:', userError.message);
        } else {
          userData = {
            id: user.id,
            full_name: user.full_name || 'Unknown Student',
            email: user.email || 'N/A',
            username: user.username || 'N/A', // This will be used as admission number
            role: user.role
          };
          console.log('✅ SIMPLE TEST: Student found:', userData);
        }
      }
      
      results.push({
        request_id: request.id,
        cleaning_type: request.cleaning_type,
        status: request.status,
        student_id: request.student_id,
        user_data: userData
      });
    }
    
    res.json({
      success: true,
      data: {
        requests: results,
        summary: {
          total_requests: requests?.length || 0,
          requests_with_user_data: results.filter(r => r.user_data).length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ SIMPLE TEST: Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

/**
 * @route   GET /api/cleaning-requests/debug-data
 * @desc    Debug endpoint to check what data is being returned
 * @access  Private (Staff)
 */
router.get('/debug-data', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 DEBUG DATA: Checking cleaning requests data...');
    
    // Get all cleaning requests with basic data
    const { data: requests, error: requestsError } = await supabase
      .from('cleaning_requests')
      .select('id, student_id, cleaning_type, status, created_at')
      .order('created_at', { ascending: false });
    
    if (requestsError) {
      return res.json({ success: false, error: requestsError.message });
    }
    
    console.log('🔍 DEBUG DATA: Found requests:', requests?.length || 0);
    
    // For each request, get detailed user data
    const detailedRequests = [];
    for (const request of requests || []) {
      console.log('🔍 DEBUG DATA: Processing request:', request.id);
      
      // Get user data
      let userData = null;
      if (request.student_id) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email, username, linked_admission_number, role')
          .eq('id', request.student_id)
          .single();
        
        if (!userError && user) {
          userData = user;
          console.log('✅ DEBUG DATA: User found:', {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            username: user.username,
            linked_admission_number: user.linked_admission_number
          });
        } else {
          console.error('❌ DEBUG DATA: User not found for student_id:', request.student_id, userError?.message);
        }
      }
      
      // Get admission registry data
      let admissionData = null;
      if (request.student_id) {
        const { data: admission, error: admissionError } = await supabase
          .from('admission_registry')
          .select('admission_number, user_id')
          .eq('user_id', request.student_id)
          .single();
        
        if (!admissionError && admission) {
          admissionData = admission;
          console.log('✅ DEBUG DATA: Admission found:', admission);
        } else {
          console.error('❌ DEBUG DATA: Admission not found for user_id:', request.student_id, admissionError?.message);
        }
      }
      
      detailedRequests.push({
        ...request,
        userData,
        admissionData
      });
    }
    
    res.json({
      success: true,
      data: {
        requests: detailedRequests,
        summary: {
          total_requests: requests?.length || 0,
          requests_with_user_data: detailedRequests.filter(r => r.userData).length,
          requests_with_admission_data: detailedRequests.filter(r => r.admissionData).length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ DEBUG DATA: Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

/**
 * @route   GET /api/cleaning-requests/test-admission
 * @desc    Test endpoint to check admission registry data
 * @access  Private (Staff)
 */
router.get('/test-admission', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 TEST ADMISSION: Checking admission registry...');
    
    // Check if table exists and has data
    const { data: allAdmissions, error: allError } = await supabase
      .from('admission_registry')
      .select('*');
    
    console.log('🔍 TEST ADMISSION: All admissions:', allAdmissions);
    console.log('🔍 TEST ADMISSION: Error:', allError?.message || null);
    
    // Check specific user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', 'aswinmurali2026@mca.ajce.in')
      .single();
    
    console.log('🔍 TEST ADMISSION: User data:', user);
    
    if (user) {
      const { data: admission, error: admissionError } = await supabase
        .from('admission_registry')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      console.log('🔍 TEST ADMISSION: Admission data for user:', admission);
      console.log('🔍 TEST ADMISSION: Admission error:', admissionError?.message || null);
    }
    
    res.json({
      success: true,
      data: {
        allAdmissions,
        user,
        admission: user ? await supabase.from('admission_registry').select('*').eq('user_id', user.id).single() : null
      }
    });
    
  } catch (error) {
    console.error('❌ TEST ADMISSION: Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

/**
 * @route   GET /api/cleaning-requests
 * @desc    Get all cleaning requests
 * @access  Private (Staff)
 */
router.get('/', authMiddleware, staffMiddleware, [
  body('status').optional().isIn(['pending', 'approved', 'in_progress', 'completed', 'cancelled']),
  body('page').optional().isInt({ min: 1 }),
  body('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    console.log('🔍 CLEANING REQUESTS: Fetching cleaning requests...');
    
    // Build the query - start with basic fields to avoid relationship issues
    let query = supabase
      .from('cleaning_requests')
      .select(`
        id,
        preferred_date,
        preferred_time,
        cleaning_type,
        special_instructions,
        status,
        created_at,
        updated_at,
        completed_at,
        notes,
        room_id,
        student_id
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status);
      console.log('🔍 CLEANING REQUESTS: Filtering by status:', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('❌ CLEANING REQUESTS: Query error:', error);
      throw new Error(`Failed to fetch cleaning requests: ${error.message}`);
    }

    // Manually fetch related room and user data to avoid relationship issues
    const enrichedRequests = [];
    for (const request of requests || []) {
      try {
        console.log('🔍 CLEANING REQUESTS: Processing request:', {
          id: request.id,
          student_id: request.student_id,
          room_id: request.room_id,
          cleaning_type: request.cleaning_type
        });
        // Fetch room data
        let roomData = null;
        if (request.room_id) {
          const { data: room } = await supabase
            .from('rooms')
            .select('id, room_number, floor, room_type')
            .eq('id', request.room_id)
            .single();
          roomData = room;
        }

         // Fetch user data - get full_name as student name and username as admission number
         let userData = null;
         if (request.student_id) {
           console.log('🔍 CLEANING REQUESTS: Fetching student data for student_id:', request.student_id);
           
           // Get student data from users table where role is 'student'
           const { data: user, error: userError } = await supabase
             .from('users')
             .select('id, full_name, email, username, role')
             .eq('id', request.student_id)
             .eq('role', 'student')
             .single();
           
           if (userError) {
             console.error('❌ CLEANING REQUESTS: Student fetch error:', userError);
             userData = null;
           } else {
             console.log('✅ CLEANING REQUESTS: Student data found:', user);
             
             // Use full_name as student name and username as admission number
             userData = {
               id: user.id,
               full_name: user.full_name || 'Unknown Student',
               email: user.email || 'N/A',
               admission_number: user.username || 'N/A', // username as admission number
               phone_number: 'N/A'
             };
             
             console.log('✅ CLEANING REQUESTS: Processed student data:', {
               student_name: userData.full_name,
               admission_number: userData.admission_number,
               email: userData.email
             });
           }
         }

        enrichedRequests.push({
          ...request,
          rooms: roomData,
          users: userData
        });
      } catch (enrichError) {
        console.warn('⚠️ CLEANING REQUESTS: Could not enrich request:', request.id, enrichError.message);
        // Still include the request even if enrichment fails
        enrichedRequests.push(request);
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

    console.log('✅ CLEANING REQUESTS: Found', requests?.length || 0, 'requests');

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
    console.error('❌ CLEANING REQUESTS: Error:', error);
    throw error;
  }
}));

/**
 * @route   GET /api/cleaning-requests/stats
 * @desc    Get cleaning request statistics
 * @access  Private (Staff)
 */
router.get('/stats', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 CLEANING STATS: Fetching statistics...');

    const { data: requests, error } = await supabase
      .from('cleaning_requests')
      .select('status, cleaning_type, created_at');

    if (error) {
      console.error('❌ CLEANING STATS: Query error:', error);
      throw new Error(`Failed to fetch cleaning statistics: ${error.message}`);
    }

    const stats = {
      total: requests?.length || 0,
      pending: requests?.filter(r => r.status === 'pending').length || 0,
      in_progress: requests?.filter(r => r.status === 'in_progress').length || 0,
      completed: requests?.filter(r => r.status === 'completed').length || 0,
      cancelled: requests?.filter(r => r.status === 'cancelled').length || 0
    };

    console.log('✅ CLEANING STATS: Generated statistics:', stats);

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('❌ CLEANING STATS: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-requests/:id/approve
 * @desc    Approve a cleaning request
 * @access  Private (Staff)
 */
router.put('/:id/approve', authMiddleware, staffMiddleware, [
  body('notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { notes } = req.body;

  try {
    console.log('🔍 CLEANING APPROVE: Approving request:', id);

    // Check if request exists and is pending
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be approved');
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update({
        status: 'approved',
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    console.log('✅ CLEANING APPROVE: Request approved successfully');

    res.json({
      success: true,
      data: { request: updatedRequest },
      message: 'Cleaning request approved successfully'
    });

  } catch (error) {
    console.error('❌ CLEANING APPROVE: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-requests/:id/reject
 * @desc    Reject a cleaning request
 * @access  Private (Staff)
 */
router.put('/:id/reject', authMiddleware, staffMiddleware, [
  body('notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { notes } = req.body;

  try {
    console.log('🔍 CLEANING REJECT: Rejecting request:', id);

    // Check if request exists and is pending
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be rejected');
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update({
        status: 'cancelled',
        notes: notes || 'Request rejected by staff',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    console.log('✅ CLEANING REJECT: Request rejected successfully');

    res.json({
      success: true,
      data: { request: updatedRequest },
      message: 'Cleaning request rejected successfully'
    });

  } catch (error) {
    console.error('❌ CLEANING REJECT: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-requests/:id/complete
 * @desc    Mark a cleaning request as completed
 * @access  Private (Staff)
 */
router.put('/:id/complete', authMiddleware, staffMiddleware, [
  body('notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { notes } = req.body;

  try {
    console.log('🔍 CLEANING COMPLETE: Completing request:', id);

    // Check if request exists and is approved or in_progress
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    if (!['approved', 'in_progress'].includes(request.status)) {
      throw new ValidationError('Only approved or in-progress requests can be completed');
    }

    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    console.log('✅ CLEANING COMPLETE: Request completed successfully');

    res.json({
      success: true,
      data: { request: updatedRequest },
      message: 'Cleaning request completed successfully'
    });

  } catch (error) {
    console.error('❌ CLEANING COMPLETE: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/cleaning-requests/:id/status
 * @desc    Update cleaning request status
 * @access  Private (Staff)
 */
router.put('/:id/status', authMiddleware, staffMiddleware, [
  body('status').isIn(['pending', 'approved', 'in_progress', 'completed', 'cancelled']),
  body('notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    console.log('🔍 CLEANING STATUS UPDATE: Updating request:', id, 'to status:', status);

    // Check if request exists
    const { data: request, error: requestError } = await supabase
      .from('cleaning_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Cleaning request not found');
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['approved', 'cancelled'],
      'approved': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[request.status]?.includes(status)) {
      throw new ValidationError(`Invalid status transition from ${request.status} to ${status}`);
    }

    // Update the request status
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    // Add notes if provided
    if (notes) {
      updateData.notes = notes;
    }

    // Add completion date if completing
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('cleaning_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ CLEANING STATUS UPDATE: Update error:', updateError);
      throw new Error('Failed to update cleaning request status');
    }

    console.log('✅ CLEANING STATUS UPDATE: Status updated successfully');

    res.json({
      success: true,
      message: `Cleaning request status updated to ${status}`,
      data: { request: updatedRequest }
    });

  } catch (error) {
    console.error('❌ CLEANING STATUS UPDATE: Error:', error);
    throw error;
  }
}));

module.exports = router;
