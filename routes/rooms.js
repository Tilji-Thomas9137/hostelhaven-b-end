const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/rooms/my-room
 * @desc    Get current user's room details
 * @access  Private
 */
router.get('/my-room', authMiddleware, asyncHandler(async (req, res) => {
  // First check if user exists in our database
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`
      room_id,
      rooms(*)
    `)
    .eq('auth_uid', req.user.id)
    .single();

  if (userError) {
    console.error('User fetch error:', userError);
    // If user doesn't exist in our database, create a basic profile
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

    return res.json({
      success: true,
      data: {
        room: null,
        message: 'User profile created. No room assigned yet.'
      }
    });
  }

  if (!user.room_id) {
    return res.json({
      success: true,
      data: {
        room: null,
        message: 'No room assigned'
      }
    });
  }

  // Get room details by the assigned room_id.
  // Avoid requiring a join so the UI reflects assignment immediately,
  // even if allocation tables are still syncing.
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select(`*`)
    .eq('id', user.room_id)
    .single();

  if (roomError) {
    console.error('Room fetch error:', roomError);
    // If room doesn't exist, return null
    if (roomError.code === 'PGRST116') {
      return res.json({
        success: true,
        data: {
          room: null,
          message: 'Room not found'
        }
      });
    }
    throw new ValidationError('Failed to fetch room details');
  }

  // Get roommates (other users in the same room)
  const { data: roommates, error: roommatesError } = await supabase
    .from('users')
    .select('id, full_name, email, phone, avatar_url')
    .eq('room_id', user.room_id)
    .neq('id', req.user.id);

  if (roommatesError) {
    console.error('Failed to fetch roommates:', roommatesError);
  }

  res.json({
    success: true,
    data: {
      room,
      roommates: roommates || []
    }
  });
}));

/**
 * @route   GET /api/rooms/available
 * @desc    Get available rooms with capacity awareness (single hostel system)
 * @access  Private
 */
router.get('/available', authMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('Fetching available rooms...');
    
    // First, let's get all rooms to debug
    const { data: allRooms, error: allRoomsError } = await supabase
      .from('rooms')
      .select('*')
      .order('floor')
      .order('room_number');

    if (allRoomsError) {
      console.error('Supabase error fetching all rooms:', allRoomsError);
      throw new ValidationError('Failed to fetch rooms');
    }

    console.log(`Total rooms in database: ${allRooms?.length || 0}`);
    if (allRooms && allRooms.length > 0) {
      console.log('All rooms:', allRooms.map(r => `${r.room_number} (${r.room_type}, status: ${r.status}, occupancy: ${r.current_occupancy}/${r.capacity})`));
    }

    // Now filter for available rooms
    const availableRooms = (allRooms || []).filter(room => {
      // Use the higher of current_occupancy or occupied to determine actual occupancy
      const actualOccupancy = Math.max(room.current_occupancy || 0, room.occupied || 0);
      const isAvailable = room.status !== 'full' && 
                         room.status !== 'maintenance' && 
                         actualOccupancy < (room.capacity || 0);
      console.log(`Room ${room.room_number}: status=${room.status}, current_occupancy=${room.current_occupancy}, occupied=${room.occupied}, actual=${actualOccupancy}, capacity=${room.capacity}, available=${isAvailable}`);
      return isAvailable;
    });

    console.log(`Found ${availableRooms?.length || 0} available rooms`);

    res.json({
      success: true,
      data: { rooms: availableRooms || [] }
    });
  } catch (error) {
    console.error('Error in /available endpoint:', error);
    throw error;
  }
}));

/**
 * @route   POST /api/rooms/request-change
 * @desc    Request room change
 * @access  Private
 */
router.post('/request-change', authMiddleware, [
  body('new_room_id').isUUID().withMessage('Valid room ID is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { new_room_id, reason } = req.body;

  // Get user's current room and hostel
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('room_id')
    .eq('auth_uid', req.user.id)
    .single();

  if (userError) {
    throw new ValidationError('Failed to fetch user information');
  }

  if (!user.room_id) {
    throw new ValidationError('You are not currently assigned to any room');
  }

  if (user.room_id === new_room_id) {
    throw new ValidationError('You are already in this room');
  }

  // Check if the new room is available and in the same hostel
  const { data: newRoom, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', new_room_id)
    .single();

  if (roomError || !newRoom) {
    throw new ValidationError('Room not found or not in your hostel');
  }

  if (newRoom.status !== 'available' || newRoom.occupied >= newRoom.capacity) {
    throw new ValidationError('Room is not available');
  }

  // Create room change request (using complaints table for now)
  const { data: request, error: requestError } = await supabase
    .from('complaints')
    .insert({
      user_id: req.user.id,
      room_id: user.room_id,
      title: `Room Change Request - From Room ${user.room_id} to Room ${new_room_id}`,
      description: `Reason: ${reason}\nRequested Room: ${newRoom.room_number} (Floor ${newRoom.floor})`,
      category: 'general',
      priority: 'medium',
      status: 'pending'
    })
    .select()
    .single();

  if (requestError) {
    throw new ValidationError('Failed to submit room change request');
  }

  // Notify hostel staff
  const { data: staff } = await supabase
    .from('users')
    .select('id')
    .in('role', ['warden', 'hostel_operations_assistant']);

  if (staff && staff.length > 0) {
    const notifications = staff.map(staffMember => ({
      user_id: staffMember.id,
      title: 'Room Change Request',
      message: `A student has requested to change rooms`,
      type: 'general'
    }));

    await supabase
      .from('notifications')
      .insert(notifications);
  }

  res.status(201).json({
    success: true,
    message: 'Room change request submitted successfully',
    data: { request }
  });
}));

/**
 * @route   POST /api/rooms/request
 * @desc    Request room allocation
 * @access  Private (Student)
 */
router.post('/request', authMiddleware, [
  body('room_id')
    .isUUID()
    .withMessage('Valid room ID is required'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { room_id, notes } = req.body;

  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Check if user already has an active allocation
    const { data: existingAllocation } = await supabase
      .from('room_allocations')
      .select('id, allocation_status')
      .eq('student_profile_id', userProfile.id)
      .in('allocation_status', ['pending', 'confirmed', 'active'])
      .single();

    if (existingAllocation) {
      throw new ValidationError('You already have an active room allocation');
    }

    // Check if room is available
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    if (room.status === 'full' || room.status === 'maintenance') {
      throw new ValidationError('Room is not available for allocation');
    }

    // Create room request
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .insert({
        student_profile_id: userProfile.id,
        room_id: room_id,
        request_type: 'allocation',
        notes: notes
      })
      .select()
      .single();

    if (requestError) {
      throw new ValidationError('Failed to create room request');
    }

    res.status(201).json({
      success: true,
      message: 'Room request submitted successfully',
      data: { request }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/rooms/approve
 * @desc    Approve room allocation (staff only)
 * @access  Private (Staff)
 */
router.post('/approve', authMiddleware, [
  body('request_id')
    .isUUID()
    .withMessage('Valid request ID is required'),
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { request_id, action, notes } = req.body;

  // Check if user is staff
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('auth_uid', req.user.id)
    .single();

  if (!user || !['admin', 'hostel_operations_assistant', 'warden'].includes(user.role)) {
    throw new AuthenticationError('Unauthorized - Staff access required');
  }

  try {
    // Get room request with details
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        *,
        user_profiles!inner(user_id, admission_number),
        rooms!inner(*)
      `)
      .eq('id', request_id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      throw new ValidationError('Pending room request not found');
    }

    if (action === 'reject') {
      // Reject request
      const { error: rejectError } = await supabase
        .from('room_requests')
        .update({
          status: 'rejected',
          notes: notes || 'Request rejected by staff'
        })
        .eq('id', request_id);

      if (rejectError) {
        throw new ValidationError('Failed to reject request');
      }

      return res.json({
        success: true,
        message: 'Room request rejected successfully'
      });
    }

    // Approve request - use transaction-like approach
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', request.room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    // Check capacity again (race condition protection)
    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is now at full capacity');
    }

    // Create room allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .insert({
        student_profile_id: request.student_profile_id,
        room_id: request.room_id,
        allocation_status: 'confirmed',
        notes: notes || 'Approved by staff',
        created_by: req.user.id
      })
      .select()
      .single();

    if (allocationError) {
      throw new ValidationError('Failed to create room allocation');
    }

    // Update room request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'approved',
        notes: notes || 'Approved by staff'
      })
      .eq('id', request_id);

    if (updateError) {
      throw new ValidationError('Failed to update request status');
    }

    // Update user's room assignment
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        room_id: request.room_id
      })
      .eq('id', request.user_profiles.user_id);

    if (userUpdateError) {
      console.error('Failed to update user room assignment:', userUpdateError);
      // Don't fail the entire operation
    }

    res.json({
      success: true,
      message: 'Room allocation approved successfully',
      data: { allocation }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/rooms/history
 * @desc    Get user's room assignment history
 * @access  Private
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const { data: assignments, error } = await supabase
    .from('room_allocations')
    .select(`
      *,
      rooms(room_number, floor, room_type, capacity)
    `)
    .eq('student_profile_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch room history');
  }

  res.json({
    success: true,
    data: { assignments }
  });
}));

/**
 * @route   GET /api/rooms/pending-requests
 * @desc    Get pending room requests (staff only)
 * @access  Private (Staff)
 */
router.get('/pending-requests', authMiddleware, asyncHandler(async (req, res) => {
  // Check if user is staff
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('auth_uid', req.user.id)
    .single();

  if (!user || !['admin', 'hostel_operations_assistant', 'warden'].includes(user.role)) {
    throw new AuthenticationError('Unauthorized - Staff access required');
  }

  const { data: requests, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      user_profiles!inner(
        admission_number,
        user_id,
        users!inner(full_name, email)
      ),
      rooms(room_number, floor, room_type, capacity, current_occupancy)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new ValidationError('Failed to fetch pending requests');
  }

  res.json({
    success: true,
    data: { requests }
  });
}));

/**
 * @route   GET /api/rooms/requests
 * @desc    Get user's room requests
 * @access  Private (Student)
 */
router.get('/requests', authMiddleware, asyncHandler(async (req, res) => {
  // Get user profile
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  if (profileError || !userProfile) {
    throw new ValidationError('User profile not found');
  }

  const { data: requests, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      rooms(room_number, floor, room_type, capacity)
    `)
    .eq('student_profile_id', userProfile.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch room requests');
  }

  res.json({
    success: true,
    data: { requests }
  });
}));

module.exports = router;