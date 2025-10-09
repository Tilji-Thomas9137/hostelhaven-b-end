const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
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

/**
 * @route   POST /api/room-management/rooms
 * @desc    Create a new room or generate bulk rooms
 * @access  Private (Staff)
 */
router.post('/rooms', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { rooms, generate_bulk, block } = req.body;

  // Handle bulk room generation
  if (generate_bulk && rooms && Array.isArray(rooms)) {
    try {
      console.log(`Creating ${rooms.length} rooms for Block ${block}`);
      
      // Insert all rooms in batch
      const { data: createdRooms, error } = await supabase
        .from('rooms')
        .insert(rooms)
        .select();

      if (error) {
        console.error('Bulk room creation error:', error);
        throw new ValidationError('Failed to create rooms in bulk');
      }

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdRooms.length} rooms for Block ${block}`,
        data: { 
          rooms: createdRooms,
          count: createdRooms.length,
          block: block
        }
      });
    } catch (error) {
      console.error('Bulk room creation failed:', error);
      throw new ValidationError('Failed to create rooms in bulk');
    }
  } else {
    // Handle single room creation (existing logic)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { room_number, floor, room_type, monthly_rent, status = 'available' } = req.body;

    if (!room_number || !floor || !room_type) {
      throw new ValidationError('Room number, floor, and room type are required');
    }

    // Auto-determine capacity based on room type
    const capacityMap = {
      'single': 1,
      'double': 2,
      'triple': 3
    };
    const capacity = capacityMap[room_type];

    try {
      // Check if room number already exists
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_number', room_number)
        .single();

      if (existingRoom) {
        throw new ValidationError('Room number already exists');
      }

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          room_number,
          floor: parseInt(floor),
          room_type,
          capacity,
          current_occupancy: 0,
          occupied: 0,
          status,
          price: monthly_rent || 0,
          amenities: []
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create room: ${error.message}`);
      }

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: { room }
      });
    } catch (error) {
      throw error;
    }
  }
}));

/**
 * @route   GET /api/room-management/rooms
 * @desc    Get all rooms with current occupancy
 * @access  Private (Staff)
 */
router.get('/rooms', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        floor,
        room_type,
        capacity,
        current_occupancy,
        status,
        price,
        amenities,
        created_at
      `)
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch rooms: ${error.message}`);
    }

    res.json({
      success: true,
      data: { rooms: rooms || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/room-management/available-rooms
 * @desc    Get rooms available for allocation
 * @access  Private (Staff)
 */
router.get('/available-rooms', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        floor,
        room_type,
        capacity,
        current_occupancy,
        status,
        price
      `)
      .in('status', ['available', 'partially_filled'])
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch available rooms: ${error.message}`);
    }

    // Filter rooms that still have space
    const availableRooms = (rooms || []).filter(room => 
      room.current_occupancy < room.capacity
    );

    res.json({
      success: true,
      data: { rooms: availableRooms }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/room-management/students-without-rooms
 * @desc    Get students who don't have room allocations
 * @access  Private (Staff)
 */
router.get('/students-without-rooms', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get students who don't have active room allocations
    const { data: students, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        auth_uid,
        admission_number,
        full_name,
        email,
        phone,
        course,
        year,
        status
      `)
      .eq('status', 'active')
      .not('id', 'in', `(
        SELECT DISTINCT user_id 
        FROM room_allocations 
        WHERE allocation_status IN ('confirmed', 'active')
      )`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    res.json({
      success: true,
      data: { students: students || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/room-management/allocate
 * @desc    Allocate room to student (transaction-safe)
 * @access  Private (Staff)
 */
router.post('/allocate', authMiddleware, staffMiddleware, [
  body('student_id').isUUID().withMessage('Valid student ID is required'),
  body('room_id').isUUID().withMessage('Valid room ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { student_id, room_id } = req.body;

  try {
    // Start a transaction-like process
    // 1. Check if student exists and is active
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('id', student_id)
      .eq('status', 'active')
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student not found or inactive');
    }

    // 2. Check if student already has an active allocation
    const { data: existingAllocation, error: allocationError } = await supabase
      .from('room_allocations')
      .select('id')
      .eq('user_id', student_id)
      .in('allocation_status', ['confirmed', 'active'])
      .single();

    if (existingAllocation) {
      throw new ValidationError('Student already has an active room allocation');
    }

    // 3. Check if room exists and has space
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

    // 4. Create room allocation
    const { data: newAllocation, error: createError } = await supabase
      .from('room_allocations')
      .insert({
        user_id: student_id,
        room_id: room_id,
        allocation_status: 'confirmed',
        allocated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create room allocation: ${createError.message}`);
    }

    // 5. Update room occupancy
    const newOccupancy = room.current_occupancy + 1;
    const newStatus = newOccupancy >= room.capacity ? 'full' : 
                     newOccupancy > 0 ? 'partially_filled' : 'available';

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        current_occupancy: newOccupancy,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', room_id);

    if (updateError) {
      // Rollback allocation if room update fails
      await supabase.from('room_allocations').delete().eq('id', newAllocation.id);
      throw new Error(`Failed to update room occupancy: ${updateError.message}`);
    }

    // 6. Update student's room_id in user_profiles
    const { error: studentUpdateError } = await supabase
      .from('user_profiles')
      .update({ room_id: room_id })
      .eq('id', student_id);

    if (studentUpdateError) {
      console.warn(`Failed to update student room_id: ${studentUpdateError.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        allocation: newAllocation,
        room: {
          ...room,
          current_occupancy: newOccupancy,
          status: newStatus
        },
        student: student,
        message: 'Room allocated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/room-management/deallocate
 * @desc    Deallocate room from student (transaction-safe)
 * @access  Private (Staff)
 */
router.post('/deallocate', authMiddleware, staffMiddleware, [
  body('allocation_id').isUUID().withMessage('Valid allocation ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { allocation_id } = req.body;

  try {
    // 1. Get allocation details
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        user_id,
        room_id,
        allocation_status
      `)
      .eq('id', allocation_id)
      .single();

    if (allocationError || !allocation) {
      throw new ValidationError('Allocation not found');
    }

    if (!['confirmed', 'active'].includes(allocation.allocation_status)) {
      throw new ValidationError('Allocation is not active');
    }

    // 2. Get room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, capacity, current_occupancy')
      .eq('id', allocation.room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    // 3. Update allocation status
    const { error: updateAllocationError } = await supabase
      .from('room_allocations')
      .update({
        allocation_status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', allocation_id);

    if (updateAllocationError) {
      throw new Error(`Failed to update allocation: ${updateAllocationError.message}`);
    }

    // 4. Update room occupancy
    const newOccupancy = Math.max(0, room.current_occupancy - 1);
    const newStatus = newOccupancy >= room.capacity ? 'full' : 
                     newOccupancy > 0 ? 'partially_filled' : 'available';

    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({
        current_occupancy: newOccupancy,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', allocation.room_id);

    if (updateRoomError) {
      throw new Error(`Failed to update room occupancy: ${updateRoomError.message}`);
    }

    // 5. Remove room_id from student profile
    const { error: studentUpdateError } = await supabase
      .from('user_profiles')
      .update({ room_id: null })
      .eq('id', allocation.user_id);

    if (studentUpdateError) {
      console.warn(`Failed to update student room_id: ${studentUpdateError.message}`);
    }

    res.json({
      success: true,
      data: {
        allocation_id,
        room: {
          ...room,
          current_occupancy: newOccupancy,
          status: newStatus
        },
        message: 'Room deallocated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/room-management/rooms/:id
 * @desc    Update a room
 * @access  Private (Staff)
 */
router.put('/rooms/:id', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { room_number, floor, room_type, monthly_rent, status } = req.body;

  try {
    // Check if room exists
    const { data: existingRoom, error: fetchError } = await supabase
      .from('rooms')
      .select('id, room_number, current_occupancy, room_type, capacity')
      .eq('id', id)
      .single();

    if (fetchError || !existingRoom) {
      throw new ValidationError('Room not found');
    }

    // Auto-determine capacity based on room type
    const capacityMap = {
      'single': 1,
      'double': 2,
      'triple': 3
    };
    const capacity = capacityMap[room_type] || existingRoom.capacity;

    // Check if new room number already exists (if changed)
    if (room_number && room_number !== existingRoom.room_number) {
      const { data: duplicateRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_number', room_number)
        .neq('id', id)
        .single();

      if (duplicateRoom) {
        throw new ValidationError('Room number already exists');
      }
    }

    // Validate status based on current room status and occupancy
    if (status) {
      const currentStatus = existingRoom.status?.toLowerCase();
      const occupied = existingRoom.current_occupancy || 0;
      const capacity = existingRoom.capacity || 1;
      
      console.log('Validating status update:', { 
        roomId: id, 
        roomNumber: existingRoom.room_number,
        currentStatus: currentStatus,
        occupied: occupied,
        capacity: capacity,
        newStatus: status
      });
      
      let validStatuses = [];
      
      // Status update rules based on current status and occupancy
      if (currentStatus === 'full') {
        // Full rooms cannot be updated unless room requests are cancelled
        throw new ValidationError('Cannot update full room status. Please cancel room requests first.');
      } else if (currentStatus === 'available') {
        // Available rooms can be changed to any status
        validStatuses = ['occupied', 'partially_filled', 'full', 'maintenance'];
      } else if (currentStatus === 'partially_filled') {
        // Partially filled rooms can only change to full or remain partially filled
        validStatuses = ['full', 'partially_filled'];
      } else if (currentStatus === 'occupied') {
        // Occupied rooms can only change to full or remain occupied
        validStatuses = ['full', 'occupied'];
      } else {
        // For maintenance or other statuses, allow all options
        validStatuses = ['available', 'occupied', 'partially_filled', 'full', 'maintenance'];
      }
      
      console.log('Valid statuses for current status', currentStatus, ':', validStatuses);
      
      if (!validStatuses.includes(status.toLowerCase())) {
        throw new ValidationError(`Cannot change status from '${currentStatus}' to '${status}'. Valid options: ${validStatuses.join(', ')}`);
      }
    }

    // Update the room
    const updateData = {
      ...(room_number && { room_number }),
      ...(floor && { floor: parseInt(floor) }),
      ...(room_type && { room_type, capacity }),
      ...(monthly_rent && { price: parseFloat(monthly_rent) }),
      ...(status && { status: status.toLowerCase() }),
      updated_at: new Date().toISOString()
    };

    const { data: room, error: updateError } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error(`Failed to update room: ${updateError.message}`);
    }

    res.json({
      success: true,
      message: 'Room updated successfully',
      data: { room }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   DELETE /api/room-management/rooms/:id
 * @desc    Delete a room
 * @access  Private (Staff)
 */
router.delete('/rooms/:id', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Check if room exists
    const { data: room, error: fetchError } = await supabase
      .from('rooms')
      .select('id, room_number, current_occupancy')
      .eq('id', id)
      .single();

    if (fetchError || !room) {
      throw new ValidationError('Room not found');
    }

    // Check if room has occupants
    if (room.current_occupancy > 0) {
      throw new ValidationError('Cannot delete room with occupants. Please deallocate all students first.');
    }

    // Delete the room
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete room: ${deleteError.message}`);
    }

    res.json({
      success: true,
      message: `Room ${room.room_number} deleted successfully`
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/room-management/allocations
 * @desc    Get all room allocations with details
 * @access  Private (Staff)
 */
router.get('/allocations', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: allocations, error } = await supabase
      .from('room_allocations')
      .select(`
        id,
        user_id,
        room_id,
        allocation_status,
        allocated_at,
        ended_at,
        created_at,
        user_profiles!room_allocations_user_id_fkey(
          id,
          full_name,
          email,
          admission_number
        ),
        rooms!room_allocations_room_id_fkey(
          id,
          room_number,
          floor,
          room_type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch allocations: ${error.message}`);
    }

    res.json({
      success: true,
      data: { allocations: allocations || [] }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
