const express = require('express');
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Get all room allocations
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Step 1: Fetch allocations without embedding to avoid relationship ambiguity
    const { data: allocations, error: allocationsError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        room_id,
        rooms!users_room_id_fkey(
          id,
          room_number,
          floor,
          room_type,
          capacity
        )
      `)
      .not('room_id', 'is', null)
      .order('created_at', { ascending: false });

    if (allocationsError) {
      throw new ValidationError('Failed to fetch room allocations');
    }

    const list = allocations || [];

    if (list.length === 0) {
      return res.json({ success: true, data: { allocations: [] } });
    }

    // Step 2: Format the data (already includes related data from the query)
    const enriched = list.map(a => ({
      id: a.id,
      user_id: a.id,
      room_id: a.room_id,
      status: 'active',
      allocated_at: a.created_at,
      ended_at: null,
      created_at: a.created_at,
      users: {
        id: a.id,
        full_name: a.full_name,
        email: a.email
      },
      rooms: a.rooms || null
    }));

    res.json({ success: true, data: { allocations: enriched } });
  } catch (error) {
    next(error);
  }
});

// Get available students (students without room allocation)
router.get('/available-students', authMiddleware, async (req, res, next) => {
  try {
    const { data: students, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .eq('role', 'student')
      .is('room_id', null);

    if (error) {
      throw new ValidationError('Failed to fetch available students');
    }

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    next(error);
  }
});

// Get available rooms
router.get('/available-rooms', authMiddleware, async (req, res, next) => {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'available')
      .lt('occupied', 'capacity');

    if (error) {
      throw new ValidationError('Failed to fetch available rooms');
    }

    res.json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
});

// Create room allocation
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { student_id, room_id, start_date } = req.body;

    if (!student_id || !room_id || !start_date) {
      throw new ValidationError('Student ID, Room ID, and start date are required');
    }

    // Check if student already has an active room allocation
    const { data: existingAllocation, error: checkError } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('user_id', student_id)
      .eq('status', 'active')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new ValidationError('Failed to check existing allocation');
    }

    if (existingAllocation) {
      throw new ValidationError('Student already has an active room allocation');
    }

    // Check if room is available
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .single();

    if (roomError) {
      throw new ValidationError('Room not found');
    }

    if (room.occupied >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    // Get student and room details for hostel_id
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('hostel_id')
      .eq('id', student_id)
      .single();

    if (studentError) {
      throw new ValidationError('Student not found');
    }

    // Create room allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .insert({
        user_id: student_id,
        room_id: room_id,
        allocated_at: start_date,
        allocated_by: req.user?.id || null,
        allocation_type: 'manual',
        status: 'active'
      })
      .select()
      .single();

    if (allocationError) {
      throw new ValidationError('Failed to create room allocation');
    }

    // Update user's room_id
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: room_id })
      .eq('id', student_id);

    if (updateUserError) {
      throw new ValidationError('Failed to update student room assignment');
    }

    // Update room occupancy
    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: room.occupied + 1,
        status: (room.occupied + 1 >= room.capacity) ? 'occupied' : 'available'
      })
      .eq('id', room_id);

    if (updateRoomError) {
      throw new ValidationError('Failed to update room occupancy');
    }

    // Get the complete allocation data
    const { data: completeAllocation, error: fetchError } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('id', allocation.id)
      .single();

    if (fetchError) {
      throw new ValidationError('Failed to fetch allocation details');
    }

    res.status(201).json({
      success: true,
      message: 'Room allocated successfully',
      data: completeAllocation
    });
  } catch (error) {
    next(error);
  }
});

// Deallocate room (end room allocation)
router.patch('/:id/deallocate', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { end_date } = req.body;

    if (!end_date) {
      throw new ValidationError('End date is required');
    }

    // Get current allocation
    const { data: allocation, error: fetchError } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      // Backward compatibility: try legacy table 'room_assignments'
      const { data: legacyAlloc, error: legacyErr } = await supabase
        .from('room_assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (legacyErr) {
        throw new ValidationError('Room allocation not found');
      }

      // If legacy allocation exists, deallocate using legacy schema and exit early
      if (!legacyAlloc.is_active) {
        throw new ValidationError('Room allocation is already deallocated');
      }

      const { error: legacyUpdateErr } = await supabase
        .from('room_assignments')
        .update({ 
          is_active: false,
          end_date: end_date
        })
        .eq('id', id);

      if (legacyUpdateErr) {
        throw new ValidationError('Failed to deallocate room');
      }

      // Remove room_id from user
      const { error: legacyUserErr } = await supabase
        .from('users')
        .update({ room_id: null })
        .eq('id', legacyAlloc.user_id);

      if (legacyUserErr) {
        throw new ValidationError('Failed to update student room assignment');
      }

      // Update room occupancy
      const { data: legacyRoom, error: legacyRoomErr } = await supabase
        .from('rooms')
        .select('occupied, capacity')
        .eq('id', legacyAlloc.room_id)
        .single();

      if (legacyRoomErr) {
        throw new ValidationError('Failed to fetch room details');
      }

      const { error: legacyOccErr } = await supabase
        .from('rooms')
        .update({ 
          occupied: Math.max(0, legacyRoom.occupied - 1),
          status: 'available'
        })
        .eq('id', legacyAlloc.room_id);

      if (legacyOccErr) {
        throw new ValidationError('Failed to update room occupancy');
      }

      return res.json({
        success: true,
        message: 'Room deallocated successfully'
      });
    }

    if (allocation.status !== 'active') {
      throw new ValidationError('Room allocation is already deallocated');
    }

    // Update allocation to ended
    const { error: updateAllocationError } = await supabase
      .from('room_allocations')
      .update({ 
        status: 'ended',
        ended_at: end_date
      })
      .eq('id', id);

    if (updateAllocationError) {
      throw new ValidationError('Failed to deallocate room');
    }

    // Remove room_id from user
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ room_id: null })
      .eq('id', allocation.user_id);

    if (updateUserError) {
      throw new ValidationError('Failed to update student room assignment');
    }

    // Update room occupancy
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('occupied, capacity')
      .eq('id', allocation.room_id)
      .single();

    if (roomError) {
      throw new ValidationError('Failed to fetch room details');
    }

    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({ 
        occupied: Math.max(0, room.occupied - 1),
        status: 'available'
      })
      .eq('id', allocation.room_id);

    if (updateRoomError) {
      throw new ValidationError('Failed to update room occupancy');
    }

    res.json({
      success: true,
      message: 'Room deallocated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get room allocation history for a student
router.get('/student/:student_id', authMiddleware, async (req, res, next) => {
  try {
    const { student_id } = req.params;

    const { data: allocations, error } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('user_id', student_id)
      .order('allocated_at', { ascending: false });

    if (error) {
      throw new ValidationError('Failed to fetch student room history');
    }

    res.json({
      success: true,
      data: allocations
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
