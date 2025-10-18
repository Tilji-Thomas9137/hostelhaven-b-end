const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
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

    // Check if user account is inactive or suspended
    if (userProfile.status === 'inactive' || userProfile.status === 'suspended') {
      const statusMessage = userProfile.status === 'suspended' 
        ? 'Your account has been suspended. Please contact an administrator.'
        : 'Your account is currently inactive. Please contact an administrator to activate your account.';
      throw new AuthorizationError(statusMessage);
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Student access required');
  }
};

// Middleware to check staff access (admin, warden, assistant)
const staffMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Staff access required');
    }

    // Check if user account is inactive or suspended
    if (userProfile.status === 'inactive' || userProfile.status === 'suspended') {
      const statusMessage = userProfile.status === 'suspended' 
        ? 'Your account has been suspended. Please contact an administrator.'
        : 'Your account is currently inactive. Please contact an administrator to activate your account.';
      throw new AuthorizationError(statusMessage);
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Staff access required');
  }
};

/**
 * @route   POST /api/room-requests
 * @desc    Student submits room request
 * @access  Private (Student)
 */
router.post('/', authMiddleware, studentMiddleware, [
  body('preferred_room_type').isIn(['single', 'double', 'triple']).withMessage('Invalid room type'),
  body('preferred_floor').optional().isInt({ min: 1, max: 8 }).withMessage('Floor must be between 1 and 8'),
  body('special_requirements').optional().isString().withMessage('Special requirements must be text'),
  body('urgency_level').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid urgency level')
], asyncHandler(async (req, res) => {
  console.log('🚀 ROOM REQUEST CREATION: Starting...');
  console.log('🚀 ROOM REQUEST CREATION: User ID:', req.user.id);
  console.log('🚀 ROOM REQUEST CREATION: Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ ROOM REQUEST CREATION: Validation failed:', errors.array());
    throw new ValidationError('Validation failed', errors.array());
  }

  const { preferred_room_type, preferred_floor, special_requirements, urgency_level } = req.body;

  try {
    // Resolve or create the student's user_profiles row
    const { data: userRow } = await supabase
      .from('users')
      .select('id, full_name, email, username, linked_admission_number')
      .eq('auth_uid', req.user.id)
      .maybeSingle();

    if (!userRow) {
      throw new ValidationError('User profile not found');
    }

    // Try by user_id
    let { data: student } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, admission_number')
      .eq('user_id', userRow.id)
      .maybeSingle();

    // Create a minimal profile if missing
    if (!student) {
      const minimal = {
        user_id: userRow.id,
        full_name: userRow.full_name || userRow.email,
        email: userRow.email,
        admission_number: userRow.linked_admission_number || userRow.username || userRow.email,
        profile_status: 'active',
        status: 'incomplete',
        created_at: new Date().toISOString()
      };
      const { data: created, error: createProfileErr } = await supabase
        .from('user_profiles')
        .insert(minimal)
        .select('id, full_name, email, admission_number')
        .single();
    if (createProfileErr) {
      console.warn('Failed to create minimal user_profiles row; falling back to users row as identity');
      // Fallback: construct a virtual student object from users row so request can proceed
      student = {
        id: userRow.id, // use users.id for linkage in this rare fallback
        full_name: userRow.full_name || userRow.email,
        email: userRow.email,
        admission_number: userRow.linked_admission_number || userRow.username || userRow.email
      };
    }
      student = created;
    }

    // Check if student already has an active room allocation
    let { data: existingAllocation, error: allocationError } = await supabase
      .from('room_allocations')
      .select('id')
      .or(`user_id.eq.${student.id},user_id.eq.${userRow.id}`)
      .in('allocation_status', ['confirmed', 'active'])
      .single();

    if (existingAllocation) {
      throw new ValidationError('You already have an active room allocation');
    }

    // Check if student has a pending room request
    let { data: pendingRequest, error: requestError } = await supabase
      .from('room_requests')
      .select('id')
      .or(`user_id.eq.${student.id},user_id.eq.${userRow.id}`)
      .eq('status', 'pending')
      .single();

    // If user_id column doesn't exist, try student_profile_id instead
    if (requestError && (requestError.code === '42703' || /column .*user_id.* does not exist/i.test(requestError.message))) {
      const retry = await supabase
        .from('room_requests')
        .select('id')
        .eq('student_profile_id', student.id)
        .eq('status', 'pending')
        .single();
      pendingRequest = retry.data;
      requestError = retry.error;
    }

    if (pendingRequest) {
      throw new ValidationError('You already have a pending room request');
    }

    // Extract room ID from special requirements if present
    let requestedRoomId = null;
    if (special_requirements && special_requirements.includes('REQUESTED_ROOM_ID:')) {
      const match = special_requirements.match(/REQUESTED_ROOM_ID:([a-f0-9-]+)/i);
      if (match) {
        requestedRoomId = match[1];
      }
    }

    // Create room request
    // Build safe insert payload without relying on optional columns
    const insertData = {
      user_id: userRow.id, // Use users.id, not user_profiles.id
      student_profile_id: student.id, // Link to student profile
      room_id: requestedRoomId, // Link to specific room if requested
      preferred_room_type,
      preferred_floor,
      special_requirements,
      status: 'pending',
      requested_at: new Date().toISOString()
    };
    // Only include urgency_level if sent by client (column may not exist in some DBs)
    if (urgency_level) insertData.urgency_level = urgency_level;

    // Debug logging
    console.log('🔍 Room request insert data:', {
      user_id: insertData.user_id,
      userRow_id: userRow.id,
      student_id: student.id,
      student_profile_id: insertData.student_profile_id,
      room_id: insertData.room_id,
      requested_room_id: requestedRoomId,
      preferred_room_type: insertData.preferred_room_type,
      urgency_level: insertData.urgency_level,
      special_requirements: insertData.special_requirements
    });

    // Use service role for inserts to bypass RLS safely
    console.log('📝 Inserting room request with data:', insertData);
    let { data: newRequest, error: createError } = await supabaseAdmin
      .from('room_requests')
      .insert(insertData)
      .select()
      .single();
    
    console.log('📝 Insert result:', {
      success: !createError,
      error: createError,
      newRequest: newRequest
    });

    if (createError) {
      console.error('❌ Room request creation failed:', createError);
      return res.status(400).json({
        success: false,
        message: 'Failed to create room request',
        error: createError.message
      });
    }

    if (!newRequest) {
      console.error('❌ Room request creation returned no data');
      return res.status(400).json({
        success: false,
        message: 'Room request creation failed - no data returned'
      });
    }

    // If DB complains about a missing column (e.g., urgency_level), retry without it
    if (createError && (createError.code === '42703' || /column .* does not exist/i.test(createError.message))) {
      delete insertData.urgency_level;
      let retry = await supabaseAdmin
        .from('room_requests')
        .insert(insertData)
        .select()
        .single();
      newRequest = retry.data;
      createError = retry.error;

      // If still failing because user_id column doesn't exist, try student_profile_id
      if (createError && (createError.code === '42703' || /column .*user_id.* does not exist/i.test(createError.message))) {
        console.log('🔄 Retrying with student_profile_id instead of user_id');
        const altInsert = { ...insertData };
        delete altInsert.user_id;
        altInsert.student_profile_id = student.id;
        console.log('📝 Retry insert data:', altInsert);
        
        retry = await supabaseAdmin
          .from('room_requests')
          .insert(altInsert)
          .select()
          .single();
        newRequest = retry.data;
        createError = retry.error;
        
        console.log('📝 Retry insert result:', {
          success: !createError,
          error: createError,
          newRequest: newRequest
        });
      }
    }

    if (createError) {
      console.error('❌ Failed to create room request:', createError);
      throw new Error(`Failed to create room request: ${createError.message}`);
    }

    console.log('✅ Room request created successfully:', {
      id: newRequest.id,
      user_id: newRequest.user_id,
      student_profile_id: newRequest.student_profile_id,
      room_id: newRequest.room_id,
      status: newRequest.status,
      preferred_room_type: newRequest.preferred_room_type,
      requested_room_id: requestedRoomId
    });

    // Notify staff (admin, warden, hostel_operations_assistant)
    try {
      const { data: staffList } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['admin', 'warden', 'hostel_operations_assistant']);

      const notifications = (staffList || []).map((staffUser) => ({
        user_id: staffUser.id,
        type: 'room_request',
        title: 'New Room Request',
        message: `${student.full_name} (${student.admission_number}) submitted a room request${preferred_room_type ? ` for ${preferred_room_type}` : ''}.`,
        metadata: {
          request_id: newRequest.id,
          student_id: student.id,
          admission_number: student.admission_number,
          preferred_room_type,
          preferred_floor,
          special_requirements
        },
        is_read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } catch (notifyErr) {
      console.warn('Failed to create staff notifications for room request:', notifyErr.message);
    }

    console.log('✅ ROOM REQUEST CREATION: Success! Returning response:', {
      success: true,
      data: {
        request: newRequest,
        message: 'Room request submitted successfully'
      }
    });

    res.status(201).json({
      success: true,
      data: {
        request: newRequest,
        message: 'Room request submitted successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

// TEST ENDPOINT: Direct database check (no auth required for debugging)
router.get('/test-db', asyncHandler(async (req, res) => {
  try {
    const result = await supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    res.json({
      success: true,
      count: result.data?.length || 0,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// TEST ENDPOINT: Get ALL room requests (no filtering)
router.get('/test-all', authMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 TEST-ALL: Getting ALL room requests for debugging');
    const result = await supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('🔍 TEST-ALL: Result:', result);
    
    res.json({
      success: true,
      count: result.data?.length || 0,
      data: result.data,
      user_id_from_auth: req.user.id
    });
  } catch (error) {
    console.error('🔍 TEST-ALL: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// EMERGENCY ENDPOINT: Check if ANY room requests exist (no auth)
router.get('/emergency-check', asyncHandler(async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Checking if ANY room requests exist');
    const result = await supabase
      .from('room_requests')
      .select('id, user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('🚨 EMERGENCY: Raw result:', result);
    
    res.json({
      success: true,
      exists: result.data && result.data.length > 0,
      count: result.data?.length || 0,
      sample_data: result.data,
      error: result.error
    });
  } catch (error) {
    console.error('🚨 EMERGENCY: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/room-requests/my-requests
 * @desc    Get student's own room requests
 * @access  Private (Student)
 */
router.get('/my-requests', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get the actual user_id from users table (same logic as creation)
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      return res.json({
        success: true,
        requests: []
      });
    }
    
    // Get room requests for the user
    const result = await supabase
      .from('room_requests')
      .select('*')
      .eq('user_id', userRow.id)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    const requests = result.data || [];

    res.json({
      success: true,
      requests: requests
    });
  } catch (error) {
    console.error('🚀 SIMPLE FIX: Error in my-requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching room requests',
      error: error.message
    });
  }
}));

/**

    // First try: user_id from user_profiles
    try {
      console.log('🔍 Querying room_requests with user_id:', userRow.id);
      console.log('🔍 UserRow details:', { id: userRow.id, email: userRow.email });
      console.log('🔍 Student profile details:', { id: student.id });
      
      const result1 = await supabase
        .from('room_requests')
        .select(`
          id,
          preferred_room_type,
          preferred_floor,
          special_requirements,
          urgency_level,
          status,
          requested_at,
          processed_at,
          processed_by,
          notes,
          created_at,
          allocated_room_id,
          allocated_at,
          user_id,
          student_profile_id,
          room_id,
          rooms!room_requests_allocated_room_id_fkey(
            id,
            room_number,
            floor,
            room_type,
            price
          )
        `)
        .eq('user_id', userRow.id)
        .order('created_at', { ascending: false });
      
      console.log('📊 Query result1:', {
        error: result1.error,
        data: result1.data,
        count: result1.data?.length || 0
      });
      
      if (!result1.error && result1.data && result1.data.length > 0) {
        requests = result1.data;
        console.log(`✅ Found ${requests.length} requests using user_id`);
      } else if (result1.error || !result1.data || result1.data.length === 0) {
        console.log('⚠️ No requests found with user_id, trying student_profile_id...');
        console.log('🔍 Query error details:', result1.error);
        console.log('🔍 Query result data:', result1.data);
        console.log('🔍 Querying room_requests with student_profile_id:', student.id);
        
        // If user_id doesn't exist, try to find requests by student_profile_id
        const result2 = await supabase
          .from('room_requests')
          .select(`
            id,
            preferred_room_type,
            preferred_floor,
            special_requirements,
            urgency_level,
            status,
            requested_at,
            processed_at,
            processed_by,
            notes,
            created_at,
            allocated_room_id,
            allocated_at,
            rooms!room_requests_allocated_room_id_fkey(
              id,
              room_number,
              floor,
              room_type,
              price
            )
          `)
          .eq('student_profile_id', student.id)
          .order('created_at', { ascending: false });
        
        console.log('📊 Query result2:', {
          error: result2.error,
          data: result2.data,
          count: result2.data?.length || 0
        });
        
        if (!result2.error && result2.data && result2.data.length > 0) {
          requests = result2.data;
          console.log(`✅ Found ${requests.length} requests using student_profile_id`);
        } else {
          console.log('❌ No requests found using student_profile_id:', result2.error);
          
          // DEBUG: Let's see what's actually in the room_requests table
          console.log('🔍 DEBUG: Checking all room_requests in table...');
          const debugResult = await supabase
            .from('room_requests')
            .select('id, user_id, student_profile_id, status, created_at')
            .limit(10);
          console.log('🔍 DEBUG: All room_requests:', debugResult.data);
          console.log('🔍 DEBUG: Looking for user_id:', userRow.id, 'or student_profile_id:', student.id);
          
          requests = [];
          error = result2.error;
        }
      } else if (result1.data && result1.data.length === 0) {
        console.log('✅ user_id query successful but no requests found');
        
        // DEBUG: Let's see what's actually in the room_requests table
        console.log('🔍 DEBUG: Checking all room_requests in table...');
        const debugResult = await supabase
          .from('room_requests')
          .select('id, user_id, student_profile_id, status, created_at')
          .limit(10);
        console.log('🔍 DEBUG: All room_requests:', debugResult.data);
        console.log('🔍 DEBUG: Looking for user_id:', userRow.id, 'or student_profile_id:', student.id);
        
        // Try to find requests with student_profile_id as well
        console.log('🔍 Trying student_profile_id query...');
        const result2 = await supabase
          .from('room_requests')
          .select(`
            id,
            preferred_room_type,
            preferred_floor,
            special_requirements,
            urgency_level,
            status,
            requested_at,
            processed_at,
            processed_by,
            notes,
            created_at,
            allocated_room_id,
            allocated_at,
            user_id,
            student_profile_id,
            room_id
          `)
          .eq('student_profile_id', student.id)
          .order('created_at', { ascending: false });
        
        console.log('📊 Query result2 (student_profile_id):', {
          error: result2.error,
          data: result2.data,
          count: result2.data?.length || 0
        });
        
        if (!result2.error && result2.data && result2.data.length > 0) {
          requests = result2.data;
          console.log(`✅ Found ${requests.length} requests using student_profile_id`);
        } else {
          console.log('❌ No requests found with student_profile_id either');
          
          // Let's also try a broader search - maybe the user_id in room_requests is different
          console.log('🔍 DEBUG: Trying broader search without filters...');
          const broadResult = await supabase
            .from('room_requests')
            .select('id, user_id, student_profile_id, status, created_at, preferred_room_type')
            .or(`user_id.eq.${userRow.id},student_profile_id.eq.${student.id}`)
            .limit(5);
          console.log('🔍 DEBUG: Broad search result:', broadResult.data);
        }
        
        requests = requests || [];
        error = null;
      } else {
        console.log('❌ Error with user_id query:', result1.error);
        requests = result1.data || [];
        error = result1.error;
      }
    } catch (err) {
      error = err;
    }

    if (error) {
      console.error('Error fetching room requests:', error);
      // Don't throw error, just return empty array to prevent 500
      requests = [];
    }

    // EMERGENCY FIX: Always show what's in the database
    console.log('🚨 EMERGENCY FIX: Checking database content...');
    
    try {
      // Get ALL room requests and filter manually
      const allRequestsResult = await supabase
        .from('room_requests')
        .select(`
          id,
          preferred_room_type,
          preferred_floor,
          special_requirements,
          urgency_level,
          status,
          requested_at,
          processed_at,
          processed_by,
          notes,
          created_at,
          allocated_room_id,
          allocated_at,
          user_id,
          student_profile_id,
          room_id
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log('🚨 EMERGENCY FIX: ALL room requests in database:', allRequestsResult.data);
      console.log('🚨 EMERGENCY FIX: Looking for user_id:', userRow.id);
      console.log('🚨 EMERGENCY FIX: Looking for student_profile_id:', student.id);
      
      if (!allRequestsResult.error && allRequestsResult.data) {
        // Filter manually by user_id or student_profile_id
        const filteredRequests = allRequestsResult.data.filter(req => {
          const matches = req.user_id === userRow.id || 
                         req.student_profile_id === student.id ||
                         req.user_id === student.id ||
                         req.student_profile_id === userRow.id;
          
          if (matches) {
            console.log('🚨 EMERGENCY FIX: Found matching request:', {
              id: req.id,
              user_id: req.user_id,
              student_profile_id: req.student_profile_id,
              status: req.status
            });
          }
          
          return matches;
        });
        
        console.log('🚨 EMERGENCY FIX: Filtered requests:', filteredRequests);
        
        if (filteredRequests.length > 0) {
          requests = filteredRequests;
          console.log(`🚨 EMERGENCY FIX: Found ${requests.length} requests with manual filtering`);
        } else {
          console.log('🚨 EMERGENCY FIX: No matching requests found in database');
        }
      }
    } catch (emergencyError) {
      console.error('🚨 EMERGENCY FIX: Error in aggressive search:', emergencyError);
    }

    console.log('📤 Final response:', {
      success: true,
      requestsCount: requests?.length || 0,
      requests: requests || []
    });

    res.json({
      success: true,
      data: { requests: requests || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/room-requests
 * @desc    Get all room requests (staff view)
 * @access  Private (Staff)
 */
router.get('/', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        preferred_floor,
        special_requirements,
        urgency_level,
        status,
        requested_at,
        processed_at,
        processed_by,
        notes,
        created_at,
        user_profiles!room_requests_user_id_fkey(
          id,
          full_name,
          email,
          admission_number,
          course,
          year
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch room requests: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('room_requests')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
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
 * @route   PUT /api/room-requests/:id/approve
 * @desc    Approve room request (staff only)
 * @access  Private (Staff)
 */
router.put('/:id/approve', authMiddleware, staffMiddleware, [
  body('room_id').isUUID().withMessage('Valid room ID is required'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { room_id, notes } = req.body;

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

    // Get room request
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        status
      `)
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Room request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Room request is not pending');
    }

    // Check if room is available
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, capacity, current_occupancy, status')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    if (!['available', 'partially_filled'].includes(room.status)) {
      throw new ValidationError('Room is not available for allocation');
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: staff.id,
        notes: notes || 'Request approved'
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    // Create room allocation
    const { data: newAllocation, error: allocationError } = await supabase
      .from('room_allocations')
      .insert({
        user_id: request.user_id,
        room_id: room_id,
        allocation_status: 'confirmed',
        allocated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (allocationError) {
      // Rollback request update
      await supabase.from('room_requests').update({ status: 'pending' }).eq('id', id);
      throw new Error(`Failed to create room allocation: ${allocationError.message}`);
    }

    // Update room occupancy
    const newOccupancy = room.current_occupancy + 1;
    const newStatus = newOccupancy >= room.capacity ? 'full' : 
                     newOccupancy > 0 ? 'partially_filled' : 'available';

    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({
        current_occupancy: newOccupancy,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', room_id);

    if (roomUpdateError) {
      console.warn(`Failed to update room occupancy: ${roomUpdateError.message}`);
    }

    // Update student's room_id
    const { error: studentUpdateError } = await supabase
      .from('user_profiles')
      .update({ room_id: room_id })
      .eq('id', request.user_id);

    if (studentUpdateError) {
      console.warn(`Failed to update student room_id: ${studentUpdateError.message}`);
    }

    res.json({
      success: true,
      data: {
        request_id: id,
        allocation: newAllocation,
        room: {
          ...room,
          current_occupancy: newOccupancy,
          status: newStatus
        },
        message: 'Room request approved and allocated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/room-requests/:id/reject
 * @desc    Reject room request (staff only)
 * @access  Private (Staff)
 */
router.put('/:id/reject', authMiddleware, staffMiddleware, [
  body('notes').notEmpty().withMessage('Rejection reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { notes } = req.body;

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

    // Get room request
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Room request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Room request is not pending');
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: staff.id,
        notes
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        request_id: id,
        message: 'Room request rejected successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
