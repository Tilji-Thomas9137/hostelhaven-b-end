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
      hostel_id,
      rooms(*)
    `)
    .eq('id', req.user.id)
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
        hostel: null,
        message: 'User profile created. No room assigned yet.'
      }
    });
  }

  if (!user.room_id) {
    return res.json({
      success: true,
      data: {
        room: null,
        hostel: null,
        message: 'No room assigned'
      }
    });
  }

  // Get room details with hostel information
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select(`
      *,
      room_assignments!inner(
        user_id,
        start_date,
        end_date,
        is_active,
        users(full_name, email, phone)
      )
    `)
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
          hostel: null,
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
      roommates: roommates || [],
      hostel: null
    }
  });
}));

/**
 * @route   GET /api/rooms/available
 * @desc    Get available rooms in user's hostel
 * @access  Private
 */
router.get('/available', authMiddleware, asyncHandler(async (req, res) => {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('hostel_id')
    .eq('id', req.user.id)
    .single();

  if (userError || !user.hostel_id) {
    throw new ValidationError('User not assigned to any hostel');
  }

  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(`
      *,
      hostels(name, city)
    `)
    .eq('hostel_id', user.hostel_id)
    .eq('status', 'available')
    .lt('occupied', supabase.raw('capacity'))
    .order('floor')
    .order('room_number');

  if (error) {
    throw new ValidationError('Failed to fetch available rooms');
  }

  res.json({
    success: true,
    data: { rooms }
  });
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
    .select('room_id, hostel_id')
    .eq('id', req.user.id)
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
    .eq('hostel_id', user.hostel_id)
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
      hostel_id: user.hostel_id,
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
    .eq('hostel_id', user.hostel_id)
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
 * @route   GET /api/rooms/history
 * @desc    Get user's room assignment history
 * @access  Private
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const { data: assignments, error } = await supabase
    .from('room_assignments')
    .select(`
      *,
      rooms(room_number, floor, room_type),
      hostels(name, city)
    `)
    .eq('user_id', req.user.id)
    .order('start_date', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch room history');
  }

  res.json({
    success: true,
    data: { assignments }
  });
}));

module.exports = router;