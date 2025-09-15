const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError, DatabaseError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin access required');
  }
};

/**
 * @route   POST /api/room-allocation/rooms
 * @desc    Admin adds a new room
 * @access  Private (Admin only)
 */
router.post('/rooms', authMiddleware, adminMiddleware, [
  body('room_number').notEmpty().withMessage('Room number is required'),
  body('floor').optional().isInt({ min: 0 }).withMessage('Floor must be a positive integer'),
  body('room_type').optional().isIn(['standard', 'deluxe', 'premium', 'suite']).withMessage('Invalid room type'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be positive'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { room_number, floor, room_type, capacity, price, amenities } = req.body;

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({
      room_number,
      floor,
      room_type: room_type || 'standard',
      capacity,
      price,
      amenities: amenities || []
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ValidationError('Room number already exists');
    }
    throw new ValidationError('Failed to create room');
  }

  res.status(201).json({
    success: true,
    message: 'Room created successfully',
    data: { room }
  });
}));

/**
 * @route   GET /api/room-allocation/rooms
 * @desc    Get all rooms with availability info
 * @access  Public
 */
router.get('/rooms', [
  query('status').optional().isIn(['available', 'occupied', 'maintenance', 'reserved']),
  query('room_type').optional().isIn(['standard', 'deluxe', 'premium', 'suite']),
  query('floor').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, room_type, floor } = req.query;

  let query = supabase
    .from('rooms')
    .select('*')
    .order('room_number');

  if (status) query = query.eq('status', status);
  if (room_type) query = query.eq('room_type', room_type);
  if (floor) query = query.eq('floor', floor);

  const { data: rooms, error } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch rooms');
  }

  // Add availability info
  const roomsWithAvailability = rooms.map(room => {
    const occupied = room.occupied || room.current_occupancy || 0;
    return {
      ...room,
      available_spots: room.capacity - occupied,
      is_available: occupied < room.capacity && room.status === 'available'
    };
  });

  res.json({
    success: true,
    data: { rooms: roomsWithAvailability }
  });
}));

/**
 * @route   PUT /api/room-allocation/rooms/:id
 * @desc    Update room details
 * @access  Private (Admin only)
 */
router.put('/rooms/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { room_number, floor, room_type, capacity, price, amenities, status } = req.body;

  // Check if room exists
  const { data: existingRoom, error: fetchError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingRoom) {
    throw new ValidationError('Room not found');
  }

  // Prepare update data
  const updateData = {};
  if (room_number !== undefined) updateData.room_number = room_number;
  if (floor !== undefined) updateData.floor = floor;
  if (room_type !== undefined) updateData.room_type = room_type;
  if (capacity !== undefined) updateData.capacity = capacity;
  if (price !== undefined) updateData.price = price;
  if (amenities !== undefined) updateData.amenities = amenities;
  if (status !== undefined) updateData.status = status;

  // Check for duplicate room number if room_number is being updated
  if (room_number && room_number !== existingRoom.room_number) {
    const { data: duplicateRoom, error: duplicateError } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', room_number)
      .neq('id', id)
      .single();

    if (duplicateRoom) {
      throw new ValidationError('Room number already exists');
    }
  }

  const { data: updatedRoom, error } = await supabase
    .from('rooms')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating room:', error);
    throw new ValidationError('Failed to update room');
  }

  res.json({
    success: true,
    message: 'Room updated successfully',
    data: { room: updatedRoom }
  });
}));

/**
 * @route   POST /api/room-allocation/request
 * @desc    Student requests room allocation
 * @access  Private
 */
router.post('/request', authMiddleware, [
  body('preferred_room_type').optional().isIn(['standard', 'deluxe', 'premium', 'suite']),
  body('preferred_floor').optional().isInt({ min: 0 }),
  body('preferred_amenities').optional().isArray().withMessage('Preferred amenities must be an array'),
  body('special_requirements').optional().isString(),
  body('expires_at').optional().isISO8601()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { preferred_room_type, preferred_floor, preferred_amenities, special_requirements, expires_at } = req.body;

  // Check if user already has an active request
  const { data: existingRequest, error: checkError } = await supabase
    .from('room_requests')
    .select('id, status')
    .eq('user_id', req.user.id)
    .in('status', ['pending', 'waitlisted'])
    .single();

  if (existingRequest) {
    throw new ValidationError('You already have an active room request');
  }

  // Check if user already has a room
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('room_id')
    .eq('id', req.user.id)
    .single();

  if (userProfile?.room_id) {
    throw new ValidationError('You already have a room allocated');
  }

  // Prepare insert data, excluding preferred_amenities if column doesn't exist
  const insertData = {
    user_id: req.user.id,
    preferred_room_type,
    preferred_floor,
    special_requirements,
    expires_at: expires_at ? new Date(expires_at) : null
  };

  // Only include preferred_amenities if it's provided and not empty
  if (preferred_amenities && Array.isArray(preferred_amenities) && preferred_amenities.length > 0) {
    insertData.preferred_amenities = preferred_amenities;
  }

  const { data: request, error } = await supabase
    .from('room_requests')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new ValidationError('Failed to create room request');
  }

  res.status(201).json({
    success: true,
    message: 'Room request submitted successfully',
    data: { request }
  });
}));

/**
 * @route   GET /api/room-allocation/request
 * @desc    Get user's room request status
 * @access  Private
 */
router.get('/request', authMiddleware, asyncHandler(async (req, res) => {
  const { data: request, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      allocated_room:rooms(room_number, room_type, floor, price)
    `)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new ValidationError('Failed to fetch room request');
  }

  console.log(`Fetching request for user ${req.user.id}:`, request);
  res.json({
    success: true,
    data: { request: request || null }
  });
}));

/**
 * @route   GET /api/room-allocation/requests
 * @desc    Get all room requests (Admin only)
 * @access  Private (Admin only)
 */
router.get('/requests', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['pending', 'allocated', 'waitlisted', 'cancelled', 'expired']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('room_requests')
    .select(`
      *,
      users!room_requests_user_id_fkey(
        id,
        full_name,
        email,
        phone,
        user_profiles(admission_number, course, batch_year)
      )
    `)
    .order('priority_score', { ascending: false })
    .order('requested_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data: requests, error } = await query;

  if (error) {
    console.error('❌ Database query error:', error);
    throw new DatabaseError('Failed to fetch room requests', error);
  }

  res.json({
    success: true,
    data: { requests }
  });
}));

/**
 * @route   PUT /api/room-allocation/requests/:id/approve
 * @desc    Approve a room request
 * @access  Private (Admin only)
 */
router.put('/requests/:id/approve', authMiddleware, adminMiddleware, [
  body('room_id').notEmpty().withMessage('Room ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { room_id } = req.body;

  // Get the request first (avoid filtering by status in the query to prevent false negatives)
  const { data: request, error: requestError } = await supabase
    .from('room_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (requestError || !request) {
    throw new ValidationError('Room request not found');
  }

  // Validate current status (allow recovery if request shows allocated but user/allocation not synced)
  const isRequestApprovable = ['pending', 'waitlisted'].includes(request.status) || request.status === 'allocated';
  if (!isRequestApprovable) {
    throw new ValidationError(`Room request is not approvable (current status: ${request.status})`);
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

  // Check if room has capacity
  const currentOccupancy = room.occupied || room.current_occupancy || 0;
  if (currentOccupancy >= room.capacity) {
    throw new ValidationError('Room is at full capacity');
  }

  // If already has an active allocation, short-circuit success
  const { data: activeAlloc, error: activeAllocErr } = await supabase
    .from('room_assignments')
    .select('*')
    .eq('user_id', request.user_id)
    .eq('is_active', true)
    .single();

  if (!activeAllocErr && activeAlloc) {
    return res.json({
      success: true,
      message: 'Room request already allocated',
      data: { request }
    });
  }

  // Use the sync function to update all tables atomically
  const { data: syncResult, error: syncError } = await supabase
    .rpc('sync_allocation_tables', {
      p_user_id: request.user_id,
      p_room_id: room_id,
      p_allocated_by: req.user.id,
      p_allocation_type: 'manual'
    });

  if (syncError) {
    console.error('Failed to sync allocation tables:', syncError);
    // Fallback manual sync to recover when DB function is out-of-date
    // 1) Ensure no active allocation
    const { data: existingAllocation, error: checkError } = await supabase
      .from('room_assignments')
      .select('*')
      .eq('user_id', request.user_id)
      .eq('is_active', true)
      .single();
    if (checkError && checkError.code !== 'PGRST116') {
      throw new ValidationError('Failed to check existing allocation');
    }
    if (!existingAllocation) {
      const { data: allocation, error: allocationError } = await supabase
        .from('room_assignments')
        .insert({
          user_id: request.user_id,
          room_id: room_id,
          hostel_id: null,
          start_date: new Date().toISOString().slice(0, 10),
          is_active: true
        })
        .select()
        .single();
      if (allocationError) {
        throw new ValidationError('Failed to create room allocation');
      }
    }

    // 2) Update user
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: room_id })
      .eq('id', request.user_id);
    if (updateUserError) {
      throw new ValidationError('Failed to update student room assignment');
    }

    // 3) Update room occupancy/status
    const { data: currentRoom } = await supabase
      .from('rooms')
      .select('occupied, capacity')
      .eq('id', room_id)
      .single();
    const newOccupiedManual = Math.max(0, (currentRoom?.occupied || 0) + 1);
    await supabase
      .from('rooms')
      .update({
        occupied: newOccupiedManual,
        status: newOccupiedManual >= room.capacity ? 'occupied' : 'available'
      })
      .eq('id', room_id);
  }

  // Update room occupancy/status defensively in case trigger/function didn't adjust
  const newOccupied = (room.occupied || 0) + 1;
  await supabase
    .from('rooms')
    .update({ 
      occupied: newOccupied,
      status: newOccupied >= room.capacity ? 'occupied' : 'available'
    })
    .eq('id', room_id);

  // Finally set request to allocated if not already
  if (request.status !== 'allocated' || request.allocated_room_id !== room_id) {
    const { error: finalUpdateError } = await supabase
      .from('room_requests')
      .update({
        status: 'allocated',
        allocated_room_id: room_id,
        allocated_at: new Date().toISOString(),
        allocated_by: req.user.id
      })
      .eq('id', id);
    if (finalUpdateError) {
      console.warn('Warning: request update post-sync failed:', finalUpdateError.message);
    }
  }

  res.json({
    success: true,
    message: 'Room request approved successfully',
    data: { request: updatedRequest }
  });
}));

/**
 * @route   PUT /api/room-allocation/requests/:id/cancel
 * @desc    Cancel a room request
 * @access  Private (Admin only)
 */
router.put('/requests/:id/cancel', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: request, error: requestError } = await supabase
    .from('room_requests')
    .select('*')
    .eq('id', id)
    .in('status', ['pending', 'waitlisted'])
    .single();

  if (requestError || !request) {
    throw new ValidationError('Room request not found or cannot be cancelled');
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from('room_requests')
    .update({
      status: 'cancelled'
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    throw new ValidationError('Failed to cancel room request');
  }

  res.json({
    success: true,
    message: 'Room request cancelled successfully',
    data: { request: updatedRequest }
  });
}));

/**
 * @route   GET /api/room-allocation/requests/:id
 * @desc    Get specific room request details
 * @access  Private (Admin only)
 */
router.get('/requests/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: request, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      users!room_requests_user_id_fkey(
        id,
        full_name,
        email,
        phone,
        user_profiles(admission_number, course, batch_year)
      ),
      allocated_room:rooms!room_requests_allocated_room_id_fkey(
        id,
        room_number,
        floor,
        room_type,
        price,
        amenities
      )
    `)
    .eq('id', id)
    .single();

  if (error || !request) {
    throw new ValidationError('Room request not found');
  }

  res.json({
    success: true,
    data: { request }
  });
}));

/**
 * @route   POST /api/room-allocation/batch-allocate
 * @desc    Run batch allocation process
 * @access  Private (Admin only)
 */
router.post('/batch-allocate', authMiddleware, adminMiddleware, [
  body('batch_name').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { batch_name = 'Manual Batch Allocation' } = req.body;

  // Run the batch allocation function
  const { data: batchId, error } = await supabase
    .rpc('run_batch_allocation', {
      batch_name,
      run_by_user_id: req.user.id
    });

  if (error) {
    throw new ValidationError('Failed to run batch allocation');
  }

  res.json({
    success: true,
    message: 'Batch allocation completed',
    data: { batch_id: batchId }
  });
}));

/**
 * @route   GET /api/room-allocation/batch-status/:batchId
 * @desc    Get batch allocation status
 * @access  Private (Admin only)
 */
router.get('/batch-status/:batchId', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const { data: batch, error } = await supabase
    .from('allocation_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (error) {
    throw new ValidationError('Batch not found');
  }

  res.json({
    success: true,
    data: { batch }
  });
}));

/**
 * @route   POST /api/room-allocation/process-waitlist
 * @desc    Process waitlist for available rooms
 * @access  Private (Admin only)
 */
router.post('/process-waitlist', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { data: processedCount, error } = await supabase
    .rpc('process_waitlist');

  if (error) {
    throw new ValidationError('Failed to process waitlist');
  }

  res.json({
    success: true,
    message: `Processed ${processedCount} waitlist entries`,
    data: { processed_count: processedCount }
  });
}));

/**
 * @route   GET /api/room-allocation/waitlist
 * @desc    Get waitlist status
 * @access  Private (Admin only)
 */
router.get('/waitlist', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { data: waitlist, error } = await supabase
    .from('room_waitlist')
    .select(`
      *,
      user:users(full_name, email),
      room_request:room_requests(preferred_room_type, special_requirements)
    `)
    .order('position');

  if (error) {
    throw new ValidationError('Failed to fetch waitlist');
  }

  res.json({
    success: true,
    data: { waitlist }
  });
}));

/**
 * @route   PUT /api/room-allocation/request/:requestId/cancel
 * @desc    Cancel a room request (mark as cancelled)
 * @access  Private
 */
router.put('/request/:requestId/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  // Check if user owns this request
  const { data: request, error: checkError } = await supabase
    .from('room_requests')
    .select('user_id, status')
    .eq('id', requestId)
    .single();

  if (checkError || !request) {
    throw new ValidationError('Request not found');
  }

  if (request.user_id !== req.user.id) {
    throw new AuthorizationError('You can only cancel your own requests');
  }

  if (request.status === 'allocated') {
    throw new ValidationError('Cannot cancel an allocated request');
  }

  const { error } = await supabase
    .from('room_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (error) {
    throw new ValidationError('Failed to cancel request');
  }

  // Remove from waitlist if exists
  await supabase
    .from('room_waitlist')
    .delete()
    .eq('room_request_id', requestId);

  res.json({
    success: true,
    message: 'Request cancelled successfully'
  });
}));

/**
 * @route   DELETE /api/room-allocation/request/:requestId
 * @desc    Delete a room request completely from database
 * @access  Private
 */
router.delete('/request/:requestId', authMiddleware, asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  // Check if user owns this request
  const { data: request, error: checkError } = await supabase
    .from('room_requests')
    .select('user_id, status')
    .eq('id', requestId)
    .single();

  if (checkError || !request) {
    throw new ValidationError('Request not found');
  }

  if (request.user_id !== req.user.id) {
    throw new AuthorizationError('You can only delete your own requests');
  }

  if (request.status === 'allocated') {
    throw new ValidationError('Cannot delete an allocated request');
  }

  // Remove from waitlist first if exists
  await supabase
    .from('room_waitlist')
    .delete()
    .eq('room_request_id', requestId);

  // Delete the request completely
  const { error } = await supabase
    .from('room_requests')
    .delete()
    .eq('id', requestId);

  if (error) {
    console.error('Error deleting request:', error);
    throw new ValidationError('Failed to delete request');
  }

  console.log(`Request ${requestId} deleted successfully for user ${req.user.id}`);
  res.json({
    success: true,
    message: 'Request deleted successfully'
  });
}));

/**
 * @route   GET /api/room-allocation/room-options
 * @desc    Get available room types and floors from database
 * @access  Public
 */
router.get('/room-options', asyncHandler(async (req, res) => {
  try {
    console.log('Fetching room options...');
    
    // Get unique room types
    const { data: roomTypes, error: typesError } = await supabase
      .from('rooms')
      .select('room_type')
      .not('room_type', 'is', null);

    console.log('Room types query result:', { roomTypes, typesError });

    if (typesError) {
      console.error('Error fetching room types:', typesError);
      throw new ValidationError('Failed to fetch room types');
    }

    // Get unique floors
    const { data: floors, error: floorsError } = await supabase
      .from('rooms')
      .select('floor')
      .not('floor', 'is', null);

    console.log('Floors query result:', { floors, floorsError });

    if (floorsError) {
      console.error('Error fetching floors:', floorsError);
      throw new ValidationError('Failed to fetch floors');
    }

    // Process unique values
    const uniqueRoomTypes = [...new Set(roomTypes.map(room => room.room_type))];
    const uniqueFloors = [...new Set(floors.map(room => room.floor))].sort((a, b) => a - b);

    console.log('Processed unique values:', { uniqueRoomTypes, uniqueFloors });

    // If no room types found, provide default options
    let finalRoomTypes = uniqueRoomTypes;
    let finalFloors = uniqueFloors;
    
    if (uniqueRoomTypes.length === 0) {
      console.log('No room types found in database, providing default options');
      finalRoomTypes = ['standard', 'deluxe', 'premium', 'suite'];
      finalFloors = [1, 2, 3, 4, 5];
    }

    // Add descriptions for room types
    const roomTypesWithDescriptions = finalRoomTypes.map(type => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      description: getRoomTypeDescription(type)
    }));

    console.log('Final response data:', {
      room_types: roomTypesWithDescriptions,
      floors: finalFloors
    });

    res.json({
      success: true,
      data: {
        room_types: roomTypesWithDescriptions,
        floors: finalFloors
      }
    });
  } catch (error) {
    console.error('Error fetching room options:', error);
    throw new ValidationError('Failed to fetch room options');
  }
}));

// Helper function to get room type descriptions
function getRoomTypeDescription(type) {
  const descriptions = {
    'standard': 'Basic room with shared facilities',
    'deluxe': 'Enhanced room with better amenities',
    'premium': 'Luxury room with premium features',
    'suite': 'Spacious suite with private facilities',
    'economy': 'Budget-friendly room with essential amenities'
  };
  return descriptions[type] || 'Room with standard amenities';
}

/**
 * @route   GET /api/room-allocation/statistics
 * @desc    Get room allocation statistics
 * @access  Private (Admin only)
 */
router.get('/statistics', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  // Get room statistics
  const { data: roomStats, error: roomError } = await supabase
    .from('rooms')
    .select('status, capacity, occupied');

  if (roomError) {
    throw new ValidationError('Failed to fetch room statistics');
  }

  // Get request statistics
  const { data: requestStats, error: requestError } = await supabase
    .from('room_requests')
    .select('status');

  if (requestError) {
    throw new ValidationError('Failed to fetch request statistics');
  }

  // Calculate statistics
  const totalRooms = roomStats.length;
  const totalCapacity = roomStats.reduce((sum, room) => sum + room.capacity, 0);
  const totalOccupied = roomStats.reduce((sum, room) => sum + (room.occupied || room.current_occupancy || 0), 0);
  const availableRooms = roomStats.filter(room => {
    const occupied = room.occupied || room.current_occupancy || 0;
    return room.status === 'available' && occupied < room.capacity;
  }).length;

  const pendingRequests = requestStats.filter(req => req.status === 'pending').length;
  const waitlistedRequests = requestStats.filter(req => req.status === 'waitlisted').length;
  const allocatedRequests = requestStats.filter(req => req.status === 'allocated').length;

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
      requests: {
        pending: pendingRequests,
        waitlisted: waitlistedRequests,
        allocated: allocatedRequests,
        total: requestStats.length
      }
    }
  });
}));

module.exports = router;
