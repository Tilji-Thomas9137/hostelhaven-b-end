const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin/operations role
const adminMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'hostel_operations_assistant', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin/Operations access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin/Operations access required');
  }
};

/**
 * @route   POST /api/admin/room-assignment/assign
 * @desc    Admin manually assigns room to student
 * @access  Private (Admin/Operations only)
 */
router.post('/assign', authMiddleware, adminMiddleware, [
  body('user_id').isUUID().withMessage('Valid user ID is required'),
  body('room_id').isUUID().withMessage('Valid room ID is required'),
  body('allocation_type').optional().isIn(['manual', 'transfer']).withMessage('Invalid allocation type'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { user_id, room_id, allocation_type = 'manual', notes } = req.body;

  // Check if user exists and get their details
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email, room_id')
    .eq('id', user_id)
    .single();

  if (userError || !user) {
    throw new ValidationError('User not found');
  }

  // Check if user already has a room
  if (user.room_id) {
    throw new ValidationError('User already has a room assigned');
  }

  // Check if room exists and is available
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_number, capacity, occupied, status')
    .eq('id', room_id)
    .single();

  if (roomError || !room) {
    throw new ValidationError('Room not found');
  }

  if (room.occupied >= room.capacity) {
    throw new ValidationError('Room is at full capacity');
  }

  if (room.status !== 'available') {
    throw new ValidationError('Room is not available for assignment');
  }

  // Start transaction-like operations
  try {
    // 1. Update user's room_id
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: room_id })
      .eq('id', user_id);

    if (updateUserError) {
      throw new Error('Failed to update user room assignment');
    }

    // 2. Update room occupancy
    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: room.occupied + 1,
        status: (room.occupied + 1) >= room.capacity ? 'occupied' : 'available'
      })
      .eq('id', room_id);

    if (updateRoomError) {
      throw new Error('Failed to update room occupancy');
    }

    // 3. Create allocation record
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .insert({
        user_id: user_id,
        room_id: room_id,
        allocated_by: req.user.id,
        allocation_type: allocation_type,
        notes: notes
      })
      .select()
      .single();

    if (allocationError) {
      throw new Error('Failed to create allocation record');
    }

    // 4. Update any existing room request to allocated
    const { error: requestError } = await supabase
      .from('room_requests')
      .update({
        status: 'allocated',
        allocated_room_id: room_id,
        allocated_at: new Date().toISOString(),
        allocated_by: req.user.id
      })
      .eq('user_id', user_id)
      .in('status', ['pending', 'waitlisted']);

    if (requestError) {
      console.warn('Warning: Failed to update room request status:', requestError);
    }

    res.status(201).json({
      success: true,
      message: 'Room assigned successfully',
      data: {
        allocation,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email
        },
        room: {
          id: room.id,
          room_number: room.room_number
        }
      }
    });

  } catch (error) {
    // Rollback operations if needed
    console.error('Room assignment error:', error);
    throw new ValidationError('Failed to assign room: ' + error.message);
  }
}));

/**
 * @route   POST /api/admin/room-assignment/checkout
 * @desc    Admin processes student checkout (removes room assignment)
 * @access  Private (Admin/Operations only)
 */
router.post('/checkout', authMiddleware, adminMiddleware, [
  body('user_id').isUUID().withMessage('Valid user ID is required'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { user_id, reason = 'Checkout', notes } = req.body;

  // Get user's current room assignment
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, full_name, email, room_id')
    .eq('id', user_id)
    .single();

  if (userError || !user) {
    throw new ValidationError('User not found');
  }

  if (!user.room_id) {
    throw new ValidationError('User does not have a room assigned');
  }

  // Get room details
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_number, occupied')
    .eq('id', user.room_id)
    .single();

  if (roomError || !room) {
    throw new ValidationError('Room not found');
  }

  try {
    // 1. Update user's room_id to null
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: null })
      .eq('id', user_id);

    if (updateUserError) {
      throw new Error('Failed to update user room assignment');
    }

    // 2. Update room occupancy
    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: Math.max(0, room.occupied - 1),
        status: 'available'
      })
      .eq('id', user.room_id);

    if (updateRoomError) {
      throw new Error('Failed to update room occupancy');
    }

    // 3. End the current allocation
    const { error: allocationError } = await supabase
      .from('room_allocations')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_reason: reason,
        notes: notes
      })
      .eq('user_id', user_id)
      .eq('status', 'active');

    if (allocationError) {
      throw new Error('Failed to update allocation record');
    }

    res.json({
      success: true,
      message: 'Checkout processed successfully',
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email
        },
        room: {
          id: room.id,
          room_number: room.room_number
        },
        checkout_reason: reason
      }
    });

  } catch (error) {
    console.error('Checkout error:', error);
    throw new ValidationError('Failed to process checkout: ' + error.message);
  }
}));

/**
 * @route   GET /api/admin/room-assignment/assignments
 * @desc    Get all room assignments with user and room details
 * @access  Private (Admin/Operations only)
 */
router.get('/assignments', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['active', 'ended']),
  query('room_id').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status = 'active', room_id, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('room_allocations')
    .select(`
      *,
      user:users(id, full_name, email, phone, role),
      room:rooms(id, room_number, room_type, floor, price),
      allocated_by_user:users!room_allocations_allocated_by_fkey(id, full_name, email)
    `)
    .eq('status', status)
    .order('allocated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (room_id) {
    query = query.eq('room_id', room_id);
  }

  const { data: assignments, error } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch room assignments');
  }

  res.json({
    success: true,
    data: { assignments }
  });
}));

/**
 * @route   GET /api/admin/room-assignment/room-occupancy
 * @desc    Get room occupancy details
 * @access  Private (Admin/Operations only)
 */
router.get('/room-occupancy', authMiddleware, adminMiddleware, [
  query('room_id').optional().isUUID()
], asyncHandler(async (req, res) => {
  const { room_id } = req.query;

  if (room_id) {
    // Get specific room occupancy
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select(`
        *,
        current_occupants:room_allocations!inner(
          user:users(id, full_name, email, phone, role)
        )
      `)
      .eq('id', room_id)
      .eq('current_occupants.status', 'active')
      .single();

    if (roomError) {
      throw new ValidationError('Room not found');
    }

    res.json({
      success: true,
      data: { room }
    });
  } else {
    // Get all rooms with occupancy
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        *,
        current_occupants:room_allocations!inner(
          user:users(id, full_name, email, phone, role)
        )
      `)
      .eq('current_occupants.status', 'active')
      .order('room_number');

    if (roomsError) {
      throw new ValidationError('Failed to fetch room occupancy');
    }

    res.json({
      success: true,
      data: { rooms }
    });
  }
}));

/**
 * @route   POST /api/admin/room-assignment/transfer
 * @desc    Admin transfers student from one room to another
 * @access  Private (Admin/Operations only)
 */
router.post('/transfer', authMiddleware, adminMiddleware, [
  body('user_id').isUUID().withMessage('Valid user ID is required'),
  body('new_room_id').isUUID().withMessage('Valid new room ID is required'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { user_id, new_room_id, reason = 'Room Transfer', notes } = req.body;

  // Get user's current assignment
  const { data: currentAllocation, error: currentError } = await supabase
    .from('room_allocations')
    .select(`
      *,
      user:users(id, full_name, email),
      current_room:rooms(id, room_number, occupied)
    `)
    .eq('user_id', user_id)
    .eq('status', 'active')
    .single();

  if (currentError || !currentAllocation) {
    throw new ValidationError('User does not have an active room assignment');
  }

  // Check if new room is available
  const { data: newRoom, error: newRoomError } = await supabase
    .from('rooms')
    .select('id, room_number, capacity, occupied, status')
    .eq('id', new_room_id)
    .single();

  if (newRoomError || !newRoom) {
    throw new ValidationError('New room not found');
  }

  if (newRoom.occupied >= newRoom.capacity) {
    throw new ValidationError('New room is at full capacity');
  }

  if (newRoom.status !== 'available') {
    throw new ValidationError('New room is not available');
  }

  try {
    // 1. End current allocation
    const { error: endCurrentError } = await supabase
      .from('room_allocations')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        ended_reason: 'Transferred to new room',
        notes: notes
      })
      .eq('id', currentAllocation.id);

    if (endCurrentError) {
      throw new Error('Failed to end current allocation');
    }

    // 2. Update old room occupancy
    const { error: updateOldRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: Math.max(0, currentAllocation.current_room.occupied - 1),
        status: 'available'
      })
      .eq('id', currentAllocation.room_id);

    if (updateOldRoomError) {
      throw new Error('Failed to update old room occupancy');
    }

    // 3. Update user's room_id
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: new_room_id })
      .eq('id', user_id);

    if (updateUserError) {
      throw new Error('Failed to update user room assignment');
    }

    // 4. Update new room occupancy
    const { error: updateNewRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: newRoom.occupied + 1,
        status: (newRoom.occupied + 1) >= newRoom.capacity ? 'occupied' : 'available'
      })
      .eq('id', new_room_id);

    if (updateNewRoomError) {
      throw new Error('Failed to update new room occupancy');
    }

    // 5. Create new allocation record
    const { data: newAllocation, error: newAllocationError } = await supabase
      .from('room_allocations')
      .insert({
        user_id: user_id,
        room_id: new_room_id,
        allocated_by: req.user.id,
        allocation_type: 'transfer',
        notes: notes
      })
      .select()
      .single();

    if (newAllocationError) {
      throw new Error('Failed to create new allocation record');
    }

    res.json({
      success: true,
      message: 'Room transfer completed successfully',
      data: {
        user: currentAllocation.user,
        old_room: {
          id: currentAllocation.current_room.id,
          room_number: currentAllocation.current_room.room_number
        },
        new_room: {
          id: newRoom.id,
          room_number: newRoom.room_number
        },
        transfer_reason: reason,
        new_allocation: newAllocation
      }
    });

  } catch (error) {
    console.error('Room transfer error:', error);
    throw new ValidationError('Failed to transfer room: ' + error.message);
  }
}));

/**
 * @route   GET /api/admin/room-assignment/statistics
 * @desc    Get room assignment statistics
 * @access  Private (Admin/Operations only)
 */
router.get('/statistics', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  // Get room statistics
  const { data: roomStats, error: roomError } = await supabase
    .from('rooms')
    .select('status, capacity, occupied');

  if (roomError) {
    throw new ValidationError('Failed to fetch room statistics');
  }

  // Get allocation statistics
  const { data: allocationStats, error: allocationError } = await supabase
    .from('room_allocations')
    .select('status, allocation_type');

  if (allocationError) {
    throw new ValidationError('Failed to fetch allocation statistics');
  }

  // Calculate statistics
  const totalRooms = roomStats.length;
  const totalCapacity = roomStats.reduce((sum, room) => sum + room.capacity, 0);
  const totalOccupied = roomStats.reduce((sum, room) => sum + room.occupied, 0);
  const availableRooms = roomStats.filter(room => room.status === 'available' && room.occupied < room.capacity).length;

  const activeAllocations = allocationStats.filter(allocation => allocation.status === 'active').length;
  const endedAllocations = allocationStats.filter(allocation => allocation.status === 'ended').length;
  const manualAllocations = allocationStats.filter(allocation => allocation.allocation_type === 'manual').length;
  const automaticAllocations = allocationStats.filter(allocation => allocation.allocation_type === 'automatic').length;

  res.json({
    success: true,
    data: {
      rooms: {
        total: totalRooms,
        total_capacity: totalCapacity,
        total_occupied: totalOccupied,
        available: availableRooms,
        occupancy_rate: totalCapacity > 0 ? (totalOccupied / totalCapacity * 100).toFixed(2) : 0
      },
      allocations: {
        active: activeAllocations,
        ended: endedAllocations,
        manual: manualAllocations,
        automatic: automaticAllocations,
        total: allocationStats.length
      }
    }
  });
}));

module.exports = router;


