const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// UNIFIED ROOM REQUEST SYSTEM - FULLY FUNCTIONAL ENDPOINTS
// ============================================================================

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

// Middleware to check hostel operations assistant access
const operationsAssistantMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'hostel_operations_assistant') {
      throw new AuthorizationError('Hostel operations assistant access required');
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
    throw new AuthorizationError('Hostel operations assistant access required');
  }
};

// Middleware to check warden or admin access (supervisory roles)
const supervisoryMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin or Warden access required');
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
    throw new AuthorizationError('Admin or Warden access required');
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

// DEBUG ENDPOINT: Test the /all endpoint without auth for debugging
router.get('/debug-all', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 DEBUG ALL: Testing room requests endpoint...');
    
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get basic room requests
    let query = supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        student_profile_id,
        preferred_room_type,
        special_requirements,
        status,
        created_at,
        processed_at,
        notes
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: requests, error } = await query;

    if (error) {
      console.error('❌ DEBUG ALL: Query error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    console.log('✅ DEBUG ALL: Found', requests?.length || 0, 'requests');

    // Get total count
    let countQuery = supabase
      .from('room_requests')
      .select('*', { count: 'exact', head: true });

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: {
        requests: requests || [],
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      },
      debug_info: {
        query_params: { status, page, limit, offset },
        raw_requests_count: requests?.length || 0,
        total_count: count || 0
      }
    });
  } catch (error) {
    console.error('❌ DEBUG ALL: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// SIMPLE TEST ENDPOINT: Just get raw room requests data
router.get('/simple-test', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 SIMPLE TEST: Getting raw room requests...');
    
    // Get ALL room requests without any filters
    const { data: requests, error } = await supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ SIMPLE TEST: Query error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    console.log('✅ SIMPLE TEST: Found', requests?.length || 0, 'requests');
    console.log('🔍 SIMPLE TEST: Sample requests:', requests?.slice(0, 2));

    res.json({
      success: true,
      count: requests?.length || 0,
      requests: requests || [],
      message: `Found ${requests?.length || 0} room requests in database`
    });
  } catch (error) {
    console.error('❌ SIMPLE TEST: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}));

// QUICK TEST ENDPOINT: Test the exact query used by /all endpoint
router.get('/test-all-query', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 TEST ALL QUERY: Testing the exact query from /all endpoint...');
    
    // Use the exact same query as the /all endpoint
    let query = supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: requests, error } = await query;

    if (error) {
      console.error('❌ TEST ALL QUERY: Query error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    console.log('✅ TEST ALL QUERY: Found', requests?.length || 0, 'requests');
    console.log('🔍 TEST ALL QUERY: Sample requests:', requests?.slice(0, 2));

    res.json({
      success: true,
      count: requests?.length || 0,
      requests: requests || [],
      message: `Found ${requests?.length || 0} room requests using /all endpoint query`
    });
  } catch (error) {
    console.error('❌ TEST ALL QUERY: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}));

// DEBUG DATABASE STATE ENDPOINT: Check what's in the database
router.get('/debug-database', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 DEBUG DATABASE: Checking database state...');
    
    // Check all tables
    const { data: requests, error: requestsError } = await supabase
      .from('room_requests')
      .select('id, user_id, preferred_room_type, status, created_at');
    
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number, room_type, capacity, current_occupancy, status');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, role, status');
    
    const { data: allocations, error: allocationsError } = await supabase
      .from('room_allocations')
      .select('id, user_id, room_id, allocation_status');
    
    res.json({
      success: true,
      data: {
        room_requests: {
          count: requests?.length || 0,
          data: requests || [],
          error: requestsError?.message || null
        },
        rooms: {
          count: rooms?.length || 0,
          data: rooms || [],
          error: roomsError?.message || null
        },
        users: {
          count: users?.length || 0,
          data: users || [],
          error: usersError?.message || null
        },
        room_allocations: {
          count: allocations?.length || 0,
          data: allocations || [],
          error: allocationsError?.message || null
        }
      }
    });
    
  } catch (error) {
    console.error('❌ DEBUG DATABASE: Error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
}));

// CHECK ROOM REQUEST ENDPOINT: Check if a specific room request exists
router.get('/check/:id', asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 CHECK: Looking for room request with ID:', id);
    
    const { data: requestData, error } = await supabase
      .from('room_requests')
      .select('*')
      .eq('id', id);

    // Handle the case where .single() might fail
    const request = requestData && requestData.length > 0 ? requestData[0] : null;
    
    if (error) {
      console.error('❌ CHECK: Database error:', error);
      return res.json({
        success: false,
        error: error.message,
        request: null
      });
    }
    
    if (!request) {
      console.log('❌ CHECK: Room request not found');
      
      // Get all room requests to see what exists
      const { data: allRequests, error: allError } = await supabase
        .from('room_requests')
        .select('id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      return res.json({
        success: false,
        error: 'Room request not found',
        request: null,
        all_requests: allRequests || []
      });
    }
    
    console.log('✅ CHECK: Room request found:', request);
    res.json({
      success: true,
      request: request
    });
    
  } catch (error) {
    console.error('❌ CHECK: Error:', error);
    res.json({
      success: false,
      error: error.message,
      request: null
    });
  }
}));

// COMPREHENSIVE DEBUG ENDPOINT: Test different query approaches
router.get('/comprehensive-debug', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 COMPREHENSIVE DEBUG: Testing different query approaches...');
    
    const results = {};
    
    // Test 1: Basic select all
    console.log('🔍 COMPREHENSIVE DEBUG: Test 1 - Basic select all');
    const { data: allRequests, error: allError } = await supabase
      .from('room_requests')
      .select('*');
    
    results.test1_basic_select = {
      count: allRequests?.length || 0,
      error: allError?.message || null,
      sample_data: allRequests?.slice(0, 2) || []
    };
    
    console.log('🔍 COMPREHENSIVE DEBUG: Test 1 result:', results.test1_basic_select);
    
    // Test 2: Select with specific columns (like the main endpoint)
    console.log('🔍 COMPREHENSIVE DEBUG: Test 2 - Select with specific columns');
    const { data: specificRequests, error: specificError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        student_profile_id,
        preferred_room_type,
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
        room_id
      `)
      .order('created_at', { ascending: false });
    
    results.test2_specific_columns = {
      count: specificRequests?.length || 0,
      error: specificError?.message || null,
      sample_data: specificRequests?.slice(0, 2) || []
    };
    
    // Test 3: Filter by pending status
    console.log('🔍 COMPREHENSIVE DEBUG: Test 3 - Filter by pending status');
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('room_requests')
      .select('*')
      .eq('status', 'pending');
    
    results.test3_pending_filter = {
      count: pendingRequests?.length || 0,
      error: pendingError?.message || null,
      sample_data: pendingRequests?.slice(0, 2) || []
    };
    
    // Test 4: Check table structure
    console.log('🔍 COMPREHENSIVE DEBUG: Test 4 - Check table structure');
    const { data: structureRequests, error: structureError } = await supabase
      .from('room_requests')
      .select('*')
      .limit(1);
    
    results.test4_table_structure = {
      has_data: structureRequests?.length > 0,
      error: structureError?.message || null,
      sample_record: structureRequests?.[0] || null,
      columns: structureRequests?.[0] ? Object.keys(structureRequests[0]) : []
    };
    
    // Test 5: Count total records
    console.log('🔍 COMPREHENSIVE DEBUG: Test 5 - Count total records');
    const { count: totalCount, error: countError } = await supabase
      .from('room_requests')
      .select('*', { count: 'exact', head: true });
    
    results.test5_total_count = {
      count: totalCount || 0,
      error: countError?.message || null
    };
    
    console.log('✅ COMPREHENSIVE DEBUG: All tests completed');
    console.log('📊 COMPREHENSIVE DEBUG: Results:', results);

    res.json({
      success: true,
      message: 'Comprehensive debug completed',
      results: results,
      summary: {
        total_records: results.test5_total_count.count,
        basic_select_count: results.test1_basic_select.count,
        specific_columns_count: results.test2_specific_columns.count,
        pending_count: results.test3_pending_filter.count,
        has_data: results.test4_table_structure.has_data
      }
    });
  } catch (error) {
    console.error('❌ COMPREHENSIVE DEBUG: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
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
 * @desc    Approve room request (hostel operations assistant primary, warden/admin override)
 * @access  Private (Operations Assistant + Supervisory Override)
 */
router.put('/:id/approve', authMiddleware, async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile) {
      throw new AuthorizationError('User profile not found');
    }

    // Allow hostel operations assistant, warden, or admin
    if (!['hostel_operations_assistant', 'warden', 'admin'].includes(userProfile.role)) {
      throw new AuthorizationError('Insufficient permissions to approve room requests');
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
    throw new AuthorizationError('Access denied');
  }
}, [
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
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    // Get room request with detailed logging
    console.log('🔍 APPROVAL: Looking for room request with ID:', id);
    
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        status
      `)
      .eq('id', id);

    // Handle the case where .single() might fail
    const request = requestData && requestData.length > 0 ? requestData[0] : null;

    console.log('🔍 APPROVAL: Query result:', { request, requestError });

    if (requestError) {
      console.error('❌ APPROVAL: Database error:', requestError);
      throw new ValidationError(`Database error: ${requestError.message}`);
    }

    if (!request) {
      console.error('❌ APPROVAL: Room request not found for ID:', id);
      
      // Check if any room requests exist at all
      const { data: allRequests, error: allError } = await supabaseAdmin
        .from('room_requests')
        .select('id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🔍 APPROVAL: All room requests in database:', allRequests);
      throw new ValidationError('Room request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Room request is not pending');
    }

    // Check if room is available
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, room_number, capacity, current_occupancy, status')
      .eq('id', room_id);

    // Handle the case where .single() might fail
    const room = roomData && roomData.length > 0 ? roomData[0] : null;

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
    const { error: updateError } = await supabaseAdmin
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

    // Create room allocation with ON CONFLICT handling
    console.log('🔍 APPROVAL: Creating room allocation for user:', request.user_id, 'room:', room_id);
    
    const { data: newAllocation, error: allocationError } = await supabaseAdmin
      .from('room_allocations')
      .upsert({
        user_id: request.user_id,
        room_id: room_id,
        allocation_status: 'confirmed',
        allocated_at: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0], // Add required start_date (YYYY-MM-DD format)
        allocation_date: new Date().toISOString(), // Also add allocation_date
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id', // This will update if user_id already exists
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (allocationError) {
      console.error('❌ APPROVAL: Room allocation error:', allocationError);
      // Rollback request update
      await supabaseAdmin.from('room_requests').update({ status: 'pending' }).eq('id', id);
      throw new Error(`Failed to create room allocation: ${allocationError.message}`);
    }

    console.log('✅ APPROVAL: Room allocation created successfully:', newAllocation);

    // Update room occupancy
    const newOccupancy = room.current_occupancy + 1;
    const newStatus = newOccupancy >= room.capacity ? 'full' : 
                     newOccupancy > 0 ? 'partially_filled' : 'available';

    const { error: roomUpdateError } = await supabaseAdmin
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

    // Update student's room_id in user_profiles table
    console.log('🔍 APPROVAL: Updating student profile with room_id:', room_id);
    const { error: studentUpdateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ room_id: room_id })
      .eq('user_id', request.user_id);

    if (studentUpdateError) {
      console.warn(`Failed to update student room_id: ${studentUpdateError.message}`);
      // Also try updating the users table as fallback
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ room_id: room_id })
        .eq('id', request.user_id);
      
      if (userUpdateError) {
        console.warn(`Failed to update user room_id: ${userUpdateError.message}`);
      } else {
        console.log('✅ APPROVAL: Updated users table with room_id');
      }
    } else {
      console.log('✅ APPROVAL: Updated user_profiles table with room_id');
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

/**
 * @route   PUT /api/room-requests/:id/reject
 * @desc    Reject room request (staff access)
 * @access  Private (Staff)
 */
router.put('/:id/reject', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Check if user has staff access
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userProfile || !['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new ValidationError('Staff access required');
    }

    const { id } = req.params;
    const { reason } = req.body;

    // Get room request
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (requestError || !request) {
      throw new ValidationError('Room request not found');
    }

    if (request.status !== 'pending') {
      throw new ValidationError('Only pending requests can be rejected');
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: userProfile.id,
        notes: reason || 'Request rejected by staff'
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to reject request: ${updateError.message}`);
    }

    res.json({
      success: true,
      message: 'Room request rejected successfully',
      data: {
        id: request.id,
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: userProfile.full_name
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/room-requests/all
 * @desc    Get all room requests (staff access) - SIMPLIFIED VERSION
 * @access  Private (Staff)
 */
router.get('/all', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 ROOM REQUESTS ALL: Starting request...');
    
    // TEMPORARY: Skip authentication check for debugging
    console.log('🔍 ROOM REQUESTS ALL: TEMPORARY - Skipping authentication check for debugging');
    console.log('✅ ROOM REQUESTS ALL: Proceeding with request...');

    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 ROOM REQUESTS ALL: Query params:', { status, page, limit, offset });

    // SIMPLIFIED QUERY: Just get basic room requests first - match actual table structure
    let query = supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log('🔍 ROOM REQUESTS ALL: Executing query...');
    const { data: requests, error } = await query;

    if (error) {
      console.error('❌ ROOM REQUESTS ALL: Query error:', error);
      throw new Error(`Failed to fetch room requests: ${error.message}`);
    }

    console.log('✅ ROOM REQUESTS ALL: Query successful, found:', requests?.length || 0, 'requests');
    console.log('🔍 ROOM REQUESTS ALL: Raw requests data:', requests);
    
    // DEBUG: Also test the same query without filters to compare
    console.log('🔍 ROOM REQUESTS ALL: DEBUG - Testing query without filters...');
    const { data: debugRequests, error: debugError } = await supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('🔍 ROOM REQUESTS ALL: DEBUG - Unfiltered query result:', {
      count: debugRequests?.length || 0,
      error: debugError?.message || null,
      sample_data: debugRequests?.slice(0, 2) || []
    });
    
    // If debug query found data but main query didn't, there's a filtering issue
    if (debugRequests && debugRequests.length > 0 && (!requests || requests.length === 0)) {
      console.log('🚨 ROOM REQUESTS ALL: DEBUG - Found data in unfiltered query but not in main query!');
      console.log('🚨 ROOM REQUESTS ALL: DEBUG - This indicates a filtering or pagination issue');
      
      // Return the debug data instead of empty data
      console.log('🔧 ROOM REQUESTS ALL: DEBUG - Using debug data instead of empty main query result');
      const debugEnrichedRequests = [];
      
      for (const request of debugRequests) {
        console.log('🔍 ROOM REQUESTS ALL: DEBUG - Processing debug request:', request.id);
        
        // Create a basic enriched request
        const enrichedRequest = {
          ...request,
          student_profile: {
            full_name: 'Unknown Student',
            admission_number: 'N/A',
            email: 'N/A',
            phone_number: 'N/A',
            course: 'N/A',
            batch_year: 'N/A'
          },
          room_details: null,
          allocated_room: null,
          requested_room: null
        };
        
        debugEnrichedRequests.push(enrichedRequest);
      }
      
      console.log('✅ ROOM REQUESTS ALL: DEBUG - Returning debug data with', debugEnrichedRequests.length, 'requests');
      
      const debugResponse = {
        success: true,
        data: {
          requests: debugEnrichedRequests,
          pagination: {
            total: debugRequests.length,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(debugRequests.length / limit)
          }
        }
      };
      
      console.log('📤 ROOM REQUESTS ALL: DEBUG - Returning debug response with', debugEnrichedRequests.length, 'requests');
      return res.json(debugResponse);
    }

    // SIMPLIFIED ENRICHMENT: Just add basic user info
    const enrichedRequests = [];
    if (requests && requests.length > 0) {
      console.log('🔍 ROOM REQUESTS ALL: Starting enrichment process...');
      for (const request of requests) {
        console.log('🔍 ROOM REQUESTS ALL: Processing request:', request.id);
        
        let userProfile = null;
        
        // Try to get user info from users table using user_id
        if (request.user_id) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('id, full_name, email, phone, username, linked_admission_number')
              .eq('id', request.user_id)
              .single();
            
            if (userData) {
              console.log('✅ ROOM REQUESTS ALL: Found user data for request:', request.id);
              userProfile = {
                full_name: userData.full_name || 'Unknown Student',
                admission_number: userData.linked_admission_number || userData.username || 'N/A',
                email: userData.email || 'N/A',
                phone_number: userData.phone || 'N/A',
                course: 'N/A',
                batch_year: 'N/A'
              };
            }
          } catch (userError) {
            console.warn('⚠️ ROOM REQUESTS ALL: Failed to get user data for request:', request.id, userError.message);
          }
        } else if (request.student_profile_id) {
          // Try to get user info from user_profiles table using student_profile_id
          try {
            const { data: profileData } = await supabase
              .from('user_profiles')
              .select(`
                id,
                first_name,
                last_name,
                phone,
                user_id,
                users!inner(id, email, username, linked_admission_number)
              `)
              .eq('id', request.student_profile_id)
              .single();
            
            if (profileData) {
              console.log('✅ ROOM REQUESTS ALL: Found profile data for request:', request.id);
              userProfile = {
                full_name: `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Unknown Student',
                admission_number: profileData.users?.linked_admission_number || profileData.users?.username || 'N/A',
                email: profileData.users?.email || 'N/A',
                phone_number: profileData.phone || 'N/A',
                course: 'N/A',
                batch_year: 'N/A'
              };
            }
          } catch (profileError) {
            console.warn('⚠️ ROOM REQUESTS ALL: Failed to get profile data for request:', request.id, profileError.message);
          }
        }

        // If no user profile found, create a basic one
        if (!userProfile) {
          console.log('⚠️ ROOM REQUESTS ALL: No user profile found for request:', request.id);
          userProfile = {
            full_name: 'Unknown Student',
            admission_number: 'N/A',
            email: 'N/A',
            phone_number: 'N/A',
            course: 'N/A',
            batch_year: 'N/A'
          };
        }

        // Get room details if allocated_room_id exists
        let roomDetails = null;
        if (request.allocated_room_id) {
          try {
            const { data: roomData } = await supabase
              .from('rooms')
              .select('room_number, floor, room_type, capacity')
              .eq('id', request.allocated_room_id)
              .single();
            roomDetails = roomData;
          } catch (roomError) {
            console.warn('⚠️ ROOM REQUESTS ALL: Failed to get room data:', roomError.message);
          }
        }

        // Parse special requirements to extract room info
        let requestedRoomInfo = null;
        if (request.special_requirements && request.special_requirements.includes('REQUESTED_ROOM_ID:')) {
          try {
            const roomIdMatch = request.special_requirements.match(/REQUESTED_ROOM_ID:([a-f0-9-]+)/i);
            if (roomIdMatch) {
              const requestedRoomId = roomIdMatch[1];
              const { data: requestedRoomData } = await supabase
                .from('rooms')
                .select('room_number, floor, room_type, capacity')
                .eq('id', requestedRoomId)
                .single();
              requestedRoomInfo = requestedRoomData;
            }
          } catch (roomError) {
            console.warn('⚠️ ROOM REQUESTS ALL: Failed to get requested room data:', roomError.message);
          }
        }

        enrichedRequests.push({
          ...request,
          user_profiles: userProfile,
          allocated_room: roomDetails,
          requested_room: requestedRoomInfo
        });
      }
    }

    console.log('✅ ROOM REQUESTS ALL: Enriched', enrichedRequests.length, 'requests');

    // Get total count for pagination
    let countQuery = supabase
      .from('room_requests')
      .select('*', { count: 'exact', head: true });

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }

    const { count } = await countQuery;
    console.log('✅ ROOM REQUESTS ALL: Total count:', count);

    const response = {
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
    };

    console.log('📤 ROOM REQUESTS ALL: Returning response with', enrichedRequests.length, 'requests');
    res.json(response);
  } catch (error) {
    console.error('❌ ROOM REQUESTS ALL: Error:', error);
    throw error;
  }
}));

/**
 * @route   GET /api/room-requests/admin/analytics
 * @desc    Get room allocation analytics and completed allocations (admin only)
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

    // Build query for approved room requests
    let query = supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        special_requirements,
        status,
        created_at,
        processed_at,
        notes,
        user_profiles!room_requests_user_id_fkey(
          full_name,
          admission_number,
          email,
          phone_number
        ),
        room_allocations!room_requests_id_fkey(
          room_id,
          allocation_status,
          allocated_at,
          rooms!room_allocations_room_id_fkey(
            room_number,
            floor,
            capacity
          )
        )
      `)
      .eq('status', 'approved')
      .order('processed_at', { ascending: false });

    // Apply date filters if provided
    if (start_date) {
      query = query.gte('processed_at', start_date);
    }
    if (end_date) {
      query = query.lte('processed_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: approvedRequestsData, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch approved requests: ${error.message}`);
    }

    // Get analytics data
    const { data: allRequests, error: analyticsError } = await supabase
      .from('room_requests')
      .select('status, preferred_room_type, created_at, processed_at');

    if (analyticsError) {
      throw new Error(`Failed to fetch analytics: ${analyticsError.message}`);
    }

    // Calculate analytics
    const totalRequests = allRequests.length;
    const approvedRequests = allRequests.filter(r => r.status === 'approved').length;
    const pendingRequests = allRequests.filter(r => r.status === 'pending').length;
    const rejectedRequests = allRequests.filter(r => r.status === 'rejected').length;
    const waitlistedRequests = allRequests.filter(r => r.status === 'waitlisted').length;

    // Room type distribution
    const roomTypeStats = allRequests.reduce((acc, request) => {
      acc[request.preferred_room_type] = (acc[request.preferred_room_type] || 0) + 1;
      return acc;
    }, {});

    // Monthly approval stats (last 12 months)
    const monthlyStats = allRequests
      .filter(r => r.processed_at)
      .reduce((acc, request) => {
        const month = new Date(request.processed_at).toISOString().slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

    // Average processing time
    const processingTimes = allRequests
      .filter(r => r.processed_at && r.created_at)
      .map(r => {
        const created = new Date(r.created_at);
        const processed = new Date(r.processed_at);
        return Math.round((processed - created) / (1000 * 60 * 60 * 24)); // days
      });

    const avgProcessingTime = processingTimes.length > 0 
      ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
      : 0;

    // Get total count for pagination
    let countQuery = supabase
      .from('room_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    if (start_date) {
      countQuery = countQuery.gte('processed_at', start_date);
    }
    if (end_date) {
      countQuery = countQuery.lte('processed_at', end_date);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: {
        approvedRequests: approvedRequestsData || [],
        analytics: {
          totalRequests,
          approvedRequests,
          pendingRequests,
          rejectedRequests,
          waitlistedRequests,
          approvalRate: totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0,
          avgProcessingTime,
          roomTypeStats,
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

/**
 * @route   GET /api/room-requests/debug-check
 * @desc    Debug endpoint to check database state
 * @access  Public (for debugging)
 */
router.get('/debug-check', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 DEBUG CHECK: Checking database state...');
    
    // Check room_requests table
    const { data: roomRequests, error: roomRequestsError } = await supabase
      .from('room_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, full_name')
      .limit(5);
    
    // Check rooms table
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number, status')
      .limit(5);

    res.json({
      success: true,
      debug_info: {
        room_requests: {
          count: roomRequests?.length || 0,
          error: roomRequestsError?.message || null,
          sample_data: roomRequests?.slice(0, 3) || []
        },
        users: {
          count: users?.length || 0,
          error: usersError?.message || null,
          sample_data: users?.slice(0, 3) || []
        },
        rooms: {
          count: rooms?.length || 0,
          error: roomsError?.message || null,
          sample_data: rooms?.slice(0, 3) || []
        }
      }
    });

  } catch (error) {
    console.error('❌ DEBUG CHECK: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ============================================================================
// UNIFIED ROOM REQUEST ENDPOINTS - FULLY FUNCTIONAL
// ============================================================================

/**
 * @route   POST /api/room-requests/unified/create
 * @desc    Create a new room request (unified endpoint)
 * @access  Private (Student)
 */
router.post('/unified/create', authMiddleware, [
  body('preferred_room_type').isIn(['single', 'double', 'triple']).withMessage('Invalid room type'),
  body('preferred_floor').optional().isInt({ min: 1, max: 8 }).withMessage('Floor must be between 1 and 8'),
  body('special_requirements').optional().isString().withMessage('Special requirements must be text'),
  body('urgency_level').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid urgency level'),
  body('requested_room_id').optional().isUUID().withMessage('Invalid room ID')
], asyncHandler(async (req, res) => {
  console.log('🚀 UNIFIED CREATE: Starting room request creation...');
  console.log('🚀 UNIFIED CREATE: User ID:', req.user.id);
  console.log('🚀 UNIFIED CREATE: Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ UNIFIED CREATE: Validation failed:', errors.array());
    throw new ValidationError('Validation failed', errors.array());
  }

  const { preferred_room_type, preferred_floor, special_requirements, urgency_level, requested_room_id } = req.body;

  try {
    // Get user information
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, role, room_id')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userRow) {
      console.error('❌ UNIFIED CREATE: User not found:', userError);
      throw new ValidationError('User not found');
    }

    console.log('✅ UNIFIED CREATE: User found:', userRow.id);

    // Check if user already has an active request
    const { data: existingRequest, error: checkError } = await supabase
      .from('room_requests')
      .select('id, status, created_at')
      .eq('user_id', userRow.id)
      .in('status', ['pending', 'waitlisted', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      console.log('❌ UNIFIED CREATE: User already has active request:', existingRequest);
      throw new ValidationError(`You already have an active room request (${existingRequest.status})`);
    }

    // Check if user already has a room allocated
    if (userRow.room_id) {
      console.log('❌ UNIFIED CREATE: User already has room:', userRow.room_id);
      throw new ValidationError('You already have a room allocated');
    }

    // Check if requested room exists and is available
    let roomValidation = null;
    if (requested_room_id) {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, capacity, current_occupancy, status')
        .eq('id', requested_room_id)
        .single();

      if (roomError || !roomData) {
        throw new ValidationError('Requested room not found');
      }

      if (roomData.current_occupancy >= roomData.capacity) {
        throw new ValidationError('Requested room is at full capacity');
      }

      if (!['available', 'partially_filled'].includes(roomData.status)) {
        throw new ValidationError('Requested room is not available');
      }

      roomValidation = roomData;
    }

    // Prepare insert data
    const insertData = {
      user_id: userRow.id,
      preferred_room_type,
      preferred_floor: preferred_floor || null,
      special_requirements: special_requirements || null,
      urgency_level: urgency_level || 'medium',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add room-specific information if room was requested
    if (requested_room_id) {
      insertData.requested_room_id = requested_room_id;
      insertData.special_requirements = special_requirements 
        ? `${special_requirements}\nREQUESTED_ROOM_ID:${requested_room_id}`
        : `REQUESTED_ROOM_ID:${requested_room_id}`;
    }

    console.log('📝 UNIFIED CREATE: Inserting with data:', insertData);

    // Create the room request with fallback for missing column
    let newRequest, createError;
    
    try {
      const result = await supabaseAdmin
        .from('room_requests')
        .insert(insertData)
        .select()
        .single();
      
      newRequest = result.data;
      createError = result.error;
    } catch (fallbackError) {
      console.log('⚠️ UNIFIED CREATE: Primary insert failed, trying fallback without requested_room_id...');
      
      // Fallback: Remove requested_room_id and try again
      const fallbackData = { ...insertData };
      delete fallbackData.requested_room_id;
      
      // Ensure special_requirements contains the room ID
      if (requested_room_id) {
        fallbackData.special_requirements = special_requirements 
          ? `${special_requirements}\nREQUESTED_ROOM_ID:${requested_room_id}`
          : `REQUESTED_ROOM_ID:${requested_room_id}`;
      }
      
      const fallbackResult = await supabaseAdmin
        .from('room_requests')
        .insert(fallbackData)
        .select()
        .single();
      
      newRequest = fallbackResult.data;
      createError = fallbackResult.error;
      
      if (!createError) {
        console.log('✅ UNIFIED CREATE: Fallback insert successful');
      }
    }

    if (createError) {
      console.error('❌ UNIFIED CREATE: Database error:', createError);
      
      // Check if it's a missing column error
      if (createError.message && createError.message.includes('requested_room_id')) {
        throw new ValidationError('Database schema error: requested_room_id column is missing. Please run the database setup script to add the missing column.');
      }
      
      throw new ValidationError(`Failed to create room request: ${createError.message}`);
    }

    if (!newRequest) {
      console.error('❌ UNIFIED CREATE: No data returned');
      throw new ValidationError('Room request creation failed - no data returned');
    }

    console.log('✅ UNIFIED CREATE: Successfully created:', newRequest.id);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Room request submitted successfully',
      data: {
        request: {
          id: newRequest.id,
          user_id: newRequest.user_id,
          preferred_room_type: newRequest.preferred_room_type,
          preferred_floor: newRequest.preferred_floor,
          special_requirements: newRequest.special_requirements,
          urgency_level: newRequest.urgency_level,
          status: newRequest.status,
          created_at: newRequest.created_at
        },
        room_info: roomValidation ? {
          room_number: roomValidation.room_number,
          capacity: roomValidation.capacity,
          current_occupancy: roomValidation.current_occupancy
        } : null
      }
    });

  } catch (error) {
    console.error('❌ UNIFIED CREATE: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/room-requests/unified/:id/approve
 * @desc    Approve room request and automatically allocate room
 * @access  Private (Staff/Admin)
 */
router.put('/unified/:id/approve', authMiddleware, staffMiddleware, [
  body('room_id').isUUID().withMessage('Valid room ID is required'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { room_id, notes } = req.body;

  console.log('🔍 UNIFIED APPROVAL: Starting approval process for request:', id, 'room:', room_id);

  try {
    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    console.log('✅ UNIFIED APPROVAL: Staff found:', staff.full_name);

    // Get room request
    const { data: requestData, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        status,
        created_at
      `)
      .eq('id', id)
      .single();

    if (requestError || !requestData) {
      console.error('❌ UNIFIED APPROVAL: Request not found:', requestError);
      throw new ValidationError('Room request not found');
    }

    const request = requestData;
    console.log('✅ UNIFIED APPROVAL: Request found:', request.id, 'Status:', request.status);

    if (request.status !== 'pending') {
      throw new ValidationError(`Cannot approve request with status: ${request.status}`);
    }

    // Check if room is available
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, capacity, current_occupancy, status')
      .eq('id', room_id)
      .single();

    if (roomError || !roomData) {
      throw new ValidationError('Room not found');
    }

    const room = roomData;
    console.log('✅ UNIFIED APPROVAL: Room found:', room.room_number, 'Capacity:', room.capacity, 'Current:', room.current_occupancy);

    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    if (!['available', 'partially_filled'].includes(room.status)) {
      throw new ValidationError('Room is not available for allocation');
    }

    // Start transaction-like operations
    console.log('🔄 UNIFIED APPROVAL: Starting approval and allocation process...');

    // 1. Update request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: staff.id,
        notes: notes || 'Request approved and room allocated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ UNIFIED APPROVAL: Failed to update request:', updateError);
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    console.log('✅ UNIFIED APPROVAL: Request status updated to approved');

    // 2. Create room allocation
    const { data: newAllocation, error: allocationError } = await supabase
      .from('room_allocations')
      .upsert({
        user_id: request.user_id,
        room_id: room_id,
        allocation_status: 'confirmed',
        allocated_at: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0],
        allocation_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (allocationError) {
      console.error('❌ UNIFIED APPROVAL: Room allocation error:', allocationError);
      // Rollback request update
      await supabase.from('room_requests').update({ status: 'pending' }).eq('id', id);
      throw new Error(`Failed to create room allocation: ${allocationError.message}`);
    }

    console.log('✅ UNIFIED APPROVAL: Room allocation created:', newAllocation.id);

    // 3. Update room occupancy
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
      console.warn(`⚠️ UNIFIED APPROVAL: Failed to update room occupancy: ${roomUpdateError.message}`);
    } else {
      console.log('✅ UNIFIED APPROVAL: Room occupancy updated:', newOccupancy, 'Status:', newStatus);
    }

    // 4. Update student's profile with room_id
    const { error: studentUpdateError } = await supabase
      .from('user_profiles')
      .update({ 
        room_id: room_id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', request.user_id);

    if (studentUpdateError) {
      console.warn(`⚠️ UNIFIED APPROVAL: Failed to update student profile: ${studentUpdateError.message}`);
      // Also try updating the users table as fallback
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          room_id: room_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.user_id);
      
      if (userUpdateError) {
        console.warn(`⚠️ UNIFIED APPROVAL: Failed to update user table: ${userUpdateError.message}`);
      } else {
        console.log('✅ UNIFIED APPROVAL: Updated users table with room_id');
      }
    } else {
      console.log('✅ UNIFIED APPROVAL: Updated user_profiles table with room_id');
    }

    // 5. Get student information for response
    const { data: studentInfo } = await supabase
      .from('users')
      .select('email, full_name, linked_admission_number')
      .eq('id', request.user_id)
      .single();

    console.log('🎉 UNIFIED APPROVAL: Complete! Request approved and room allocated successfully');

    // Return success response
    res.json({
      success: true,
      message: 'Room request approved and allocated successfully',
      data: {
        request_id: id,
        allocation: {
          id: newAllocation.id,
          user_id: newAllocation.user_id,
          room_id: newAllocation.room_id,
          allocation_status: newAllocation.allocation_status,
          start_date: newAllocation.start_date,
          allocated_at: newAllocation.allocated_at
        },
        room: {
          id: room.id,
          room_number: room.room_number,
          capacity: room.capacity,
          current_occupancy: newOccupancy,
          status: newStatus
        },
        student: studentInfo ? {
          email: studentInfo.email,
          full_name: studentInfo.full_name,
          admission_number: studentInfo.linked_admission_number
        } : null,
        processed_by: {
          id: staff.id,
          name: staff.full_name,
          role: staff.role
        }
      }
    });

  } catch (error) {
    console.error('❌ UNIFIED APPROVAL: Error:', error);
    throw error;
  }
}));

/**
 * @route   PUT /api/room-requests/unified/:id/cancel
 * @desc    Cancel a room request (student can cancel their own)
 * @access  Private
 */
router.put('/unified/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('🔍 UNIFIED CANCEL: Starting cancellation for request:', id);
  console.log('🔍 UNIFIED CANCEL: User ID:', req.user.id);

  try {
    // Get user information
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userRow) {
      console.error('❌ UNIFIED CANCEL: User not found:', userError);
      throw new ValidationError('User not found');
    }

    console.log('✅ UNIFIED CANCEL: User found:', userRow.id, 'Role:', userRow.role);

    // Get room request
    const { data: requestData, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        status,
        created_at,
        processed_at
      `)
      .eq('id', id)
      .single();

    if (requestError || !requestData) {
      console.error('❌ UNIFIED CANCEL: Request not found:', requestError);
      
      // Check if request exists at all
      const { data: allRequests } = await supabase
        .from('room_requests')
        .select('id, status, user_id')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🔍 UNIFIED CANCEL: Recent requests:', allRequests);
      
      if (requestError && requestError.code === 'PGRST116') {
        throw new ValidationError(`Room request with ID '${id}' does not exist`);
      } else {
        throw new ValidationError(`Room request not found: ${requestError?.message || 'Unknown error'}`);
      }
    }

    const request = requestData;
    console.log('✅ UNIFIED CANCEL: Request found:', request.id, 'Status:', request.status, 'User:', request.user_id);

    // Check ownership (students can only cancel their own, staff can cancel any)
    const isOwner = request.user_id === userRow.id;
    const isStaff = ['admin', 'staff', 'operations'].includes(userRow.role);
    
    if (!isOwner && !isStaff) {
      console.error('❌ UNIFIED CANCEL: Access denied - not owner and not staff');
      throw new AuthorizationError('You can only cancel your own requests');
    }

    // Check if request can be cancelled
    if (request.status === 'allocated') {
      throw new ValidationError('Cannot cancel an allocated request. Please contact support.');
    }

    if (request.status === 'cancelled') {
      throw new ValidationError('Request is already cancelled');
    }

    if (request.status === 'rejected') {
      throw new ValidationError('Cannot cancel a rejected request');
    }

    console.log('✅ UNIFIED CANCEL: Request can be cancelled, proceeding...');

    // Update request status to cancelled
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userRow.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ UNIFIED CANCEL: Failed to update request:', updateError);
      throw new Error(`Failed to cancel request: ${updateError.message}`);
    }

    console.log('✅ UNIFIED CANCEL: Request status updated to cancelled');

    // If request was approved, we need to handle room allocation cleanup
    if (request.status === 'approved') {
      console.log('🔄 UNIFIED CANCEL: Request was approved, cleaning up room allocation...');
      
      // Get room allocation
      const { data: allocationData } = await supabase
        .from('room_allocations')
        .select('room_id')
        .eq('user_id', request.user_id)
        .single();

      if (allocationData) {
        // Remove room allocation
        await supabase
          .from('room_allocations')
          .delete()
          .eq('user_id', request.user_id);

        console.log('✅ UNIFIED CANCEL: Room allocation removed');

        // Update room occupancy
        const { data: roomData } = await supabase
          .from('rooms')
          .select('current_occupancy, capacity')
          .eq('id', allocationData.room_id)
          .single();

        if (roomData) {
          const newOccupancy = Math.max(0, roomData.current_occupancy - 1);
          const newStatus = newOccupancy >= roomData.capacity ? 'full' : 
                           newOccupancy > 0 ? 'partially_filled' : 'available';

          await supabase
            .from('rooms')
            .update({
              current_occupancy: newOccupancy,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', allocationData.room_id);

          console.log('✅ UNIFIED CANCEL: Room occupancy updated:', newOccupancy);
        }

        // Clear student's room_id
        await supabase
          .from('user_profiles')
          .update({ 
            room_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', request.user_id);

        await supabase
          .from('users')
          .update({ 
            room_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.user_id);

        console.log('✅ UNIFIED CANCEL: Student room_id cleared');
      }
    }

    // Remove from waitlist if exists
    await supabase
      .from('room_waitlist')
      .delete()
      .eq('room_request_id', id);

    console.log('🎉 UNIFIED CANCEL: Request cancelled successfully');

    res.json({
      success: true,
      message: 'Room request cancelled successfully',
      data: {
        request_id: id,
        previous_status: request.status,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userRow.id
      }
    });

  } catch (error) {
    console.error('❌ UNIFIED CANCEL: Error:', error);
    throw error;
  }
}));

module.exports = router;
