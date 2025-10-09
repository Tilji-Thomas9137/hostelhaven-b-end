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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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

    // If user_id column doesn't exist, use auth_uid instead
    if (requestError && (requestError.code === '42703' || /column .*user_id.* does not exist/i.test(requestError.message))) {
      const retry = await supabase
        .from('room_requests')
        .select('id')
        .eq('auth_uid', req.user.id)
        .eq('status', 'pending')
        .single();
      pendingRequest = retry.data;
      requestError = retry.error;
    }

    if (pendingRequest) {
      throw new ValidationError('You already have a pending room request');
    }

    // Create room request
    // Build safe insert payload without relying on optional columns
    const insertData = {
      user_id: userRow.id, // Use users.id, not user_profiles.id
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
      preferred_room_type: insertData.preferred_room_type,
      urgency_level: insertData.urgency_level
    });

    // Use service role for inserts to bypass RLS safely
    let { data: newRequest, error: createError } = await supabaseAdmin
      .from('room_requests')
      .insert(insertData)
      .select()
      .single();

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

      // If still failing because user_id column doesn't exist, switch to auth_uid
      if (createError && (createError.code === '42703' || /column .*user_id.* does not exist/i.test(createError.message))) {
        const altInsert = { ...insertData };
        delete altInsert.user_id;
        altInsert.auth_uid = req.user.id;
        retry = await supabaseAdmin
          .from('room_requests')
          .insert(altInsert)
          .select()
          .single();
        newRequest = retry.data;
        createError = retry.error;
      }
    }

    if (createError) {
      throw new Error(`Failed to create room request: ${createError.message}`);
    }

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

/**
 * @route   GET /api/room-requests/my-requests
 * @desc    Get student's own room requests
 * @access  Private (Student)
 */
router.get('/my-requests', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Resolve student profile by user_id (fallback create minimal)
    const { data: userRow } = await supabase
      .from('users')
      .select('id, full_name, email, username, linked_admission_number')
      .eq('auth_uid', req.user.id)
      .maybeSingle();

    if (!userRow) {
      throw new ValidationError('User profile not found');
    }

    let { data: student } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle();

    if (!student) {
      const { data: created, error: createProfileErr } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userRow.id,
          full_name: userRow.full_name || userRow.email,
          email: userRow.email,
          admission_number: userRow.linked_admission_number || userRow.username || userRow.email,
          profile_status: 'active',
          status: 'incomplete',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (createProfileErr) {
        throw new ValidationError('Student profile not found');
      }
      student = created;
    }

    // Get student's room requests - try multiple approaches to handle different schemas
    let requests = [];
    let error = null;

    console.log('🔍 My-requests: Looking for requests with user_id:', userRow.id);
    console.log('🔍 My-requests: Student profile id:', student.id);

    // First try: user_id from users table (this is what we used when inserting)
    try {
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
      
      console.log('🔍 My-requests: Query result1:', { error: result1.error, data: result1.data });
      
      if (!result1.error && result1.data && result1.data.length > 0) {
        console.log('✅ My-requests: Found requests:', result1.data);
        requests = result1.data;
      } else if (result1.error && (result1.error.code === '42703' || /column .*user_id.* does not exist/i.test(result1.error.message))) {
        // user_id column doesn't exist, try auth_uid
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
          .eq('auth_uid', req.user.id)
          .order('created_at', { ascending: false });
        
        requests = result2.data || [];
        error = result2.error;
      } else if (result1.data && result1.data.length === 0) {
        // user_id exists but no results, try auth_uid as fallback
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
          .eq('auth_uid', req.user.id)
          .order('created_at', { ascending: false });
        
        requests = result2.data || [];
        error = result2.error;
      } else {
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
