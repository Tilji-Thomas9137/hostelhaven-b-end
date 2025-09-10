const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check operations assistant role
const operationsMiddleware = async (req, res, next) => {
  if (!['hostel_operations_assistant', 'admin', 'warden'].includes(req.user.user_metadata?.role)) {
    throw new AuthorizationError('Operations access required');
  }
  next();
};

/**
 * @route   GET /api/operations/dashboard-stats
 * @desc    Get operations dashboard statistics
 * @access  Private (Operations staff only)
 */
router.get('/dashboard-stats', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  // Get maintenance requests count
  const { count: maintenanceCount, error: maintenanceError } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'maintenance')
    .in('status', ['pending', 'in_progress']);

  if (maintenanceError) {
    throw new ValidationError('Failed to fetch maintenance count');
  }

  // Get pending room assignments
  const { count: assignmentsCount, error: assignmentsError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .is('room_id', null);

  if (assignmentsError) {
    throw new ValidationError('Failed to fetch assignments count');
  }

  // Get today's check-ins (new users created today)
  const today = new Date().toISOString().split('T')[0];
  const { count: checkInsCount, error: checkInsError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', today);

  if (checkInsError) {
    throw new ValidationError('Failed to fetch check-ins count');
  }

  // Get available rooms count
  const { count: availableRooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available');

  if (roomsError) {
    throw new ValidationError('Failed to fetch available rooms count');
  }

  res.json({
    success: true,
    data: {
      maintenanceRequests: maintenanceCount || 0,
      pendingAssignments: assignmentsCount || 0,
      todayCheckIns: checkInsCount || 0,
      availableRooms: availableRooms || 0
    }
  });
}));

/**
 * @route   GET /api/operations/maintenance-requests
 * @desc    Get maintenance requests (complaints with maintenance category)
 * @access  Private (Operations staff only)
 */
router.get('/maintenance-requests', authMiddleware, operationsMiddleware, [
  query('status').optional().isIn(['pending', 'in_progress', 'resolved']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, priority, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('complaints')
    .select(`
      *,
      users!complaints_user_id_fkey(full_name, email, phone),
      rooms(room_number, floor),
      assigned_to_user:users!complaints_assigned_to_fkey(full_name)
    `)
    .eq('category', 'maintenance')
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (priority) {
    query = query.eq('priority', priority);
  }

  const { data: maintenanceRequests, error } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch maintenance requests');
  }

  res.json({
    success: true,
    data: {
      maintenanceRequests,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: maintenanceRequests.length
      }
    }
  });
}));

/**
 * @route   PUT /api/operations/maintenance-requests/:id/assign
 * @desc    Assign maintenance request to staff
 * @access  Private (Operations staff only)
 */
router.put('/maintenance-requests/:id/assign', authMiddleware, operationsMiddleware, [
  body('assigned_to').optional().isUUID(),
  body('status').optional().isIn(['pending', 'in_progress', 'resolved'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { assigned_to, status } = req.body;

  const updates = {};
  if (assigned_to) updates.assigned_to = assigned_to;
  if (status) updates.status = status;

  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const { data: request, error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', id)
    .eq('category', 'maintenance')
    .select(`
      *,
      users!complaints_user_id_fkey(full_name, email)
    `)
    .single();

  if (error) {
    throw new ValidationError('Failed to update maintenance request');
  }

  // Create notification for the student
  await supabase
    .from('notifications')
    .insert({
      user_id: request.user_id,
      title: 'Maintenance Request Updated',
      message: `Your maintenance request has been ${status || 'assigned'}`,
      type: 'maintenance'
    });

  res.json({
    success: true,
    message: 'Maintenance request updated successfully',
    data: { request }
  });
}));

/**
 * @route   GET /api/operations/room-assignments
 * @desc    Get students without room assignments
 * @access  Private (Operations staff only)
 */
router.get('/room-assignments', authMiddleware, operationsMiddleware, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { limit = 20, offset = 0 } = req.query;

  // Get students without room assignments
  const { data: unassignedStudents, error } = await supabase
    .from('users')
    .select(`
      *,
      hostels(name)
    `)
    .eq('role', 'student')
    .is('room_id', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch unassigned students');
  }

  // Get available rooms
  const { data: availableRooms, error: roomsError } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'available')
    .lt('occupied', supabase.raw('capacity'))
    .order('room_number');

  if (roomsError) {
    throw new ValidationError('Failed to fetch available rooms');
  }

  res.json({
    success: true,
    data: {
      unassignedStudents,
      availableRooms,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: unassignedStudents.length
      }
    }
  });
}));

/**
 * @route   POST /api/operations/room-assignments
 * @desc    Assign student to room
 * @access  Private (Operations staff only)
 */
router.post('/room-assignments', authMiddleware, operationsMiddleware, [
  body('student_id').isUUID().withMessage('Valid student ID is required'),
  body('room_id').isUUID().withMessage('Valid room ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { student_id, room_id } = req.body;

  // Check if room is available
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', room_id)
    .single();

  if (roomError || !room) {
    throw new ValidationError('Room not found');
  }

  if (room.occupied >= room.capacity) {
    throw new ValidationError('Room is at full capacity');
  }

  // Update student's room assignment
  const { data: student, error: studentError } = await supabase
    .from('users')
    .update({ 
      room_id: room_id,
      hostel_id: room.hostel_id 
    })
    .eq('id', student_id)
    .eq('role', 'student')
    .select()
    .single();

  if (studentError) {
    throw new ValidationError('Failed to assign student to room');
  }

  // Update room occupancy
  await supabase
    .from('rooms')
    .update({ 
      occupied: room.occupied + 1,
      status: room.occupied + 1 >= room.capacity ? 'occupied' : 'available'
    })
    .eq('id', room_id);

  // Create room assignment record
  await supabase
    .from('room_assignments')
    .insert({
      user_id: student_id,
      room_id: room_id,
      hostel_id: room.hostel_id,
      start_date: new Date().toISOString().split('T')[0],
      is_active: true
    });

  // Create notification for student
  await supabase
    .from('notifications')
    .insert({
      user_id: student_id,
      title: 'Room Assigned',
      message: `You have been assigned to room ${room.room_number}`,
      type: 'general'
    });

  res.status(201).json({
    success: true,
    message: 'Student assigned to room successfully',
    data: { student, room }
  });
}));

/**
 * @route   GET /api/operations/recent-checkins
 * @desc    Get recent student check-ins
 * @access  Private (Operations staff only)
 */
router.get('/recent-checkins', authMiddleware, operationsMiddleware, [
  query('days').optional().isInt({ min: 1, max: 30 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { days = 7, limit = 20 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: recentCheckIns, error } = await supabase
    .from('users')
    .select(`
      *,
      rooms(room_number, floor),
      hostels(name)
    `)
    .eq('role', 'student')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new ValidationError('Failed to fetch recent check-ins');
  }

  res.json({
    success: true,
    data: { recentCheckIns }
  });
}));

/**
 * @route   GET /api/operations/rooms-overview
 * @desc    Get rooms overview for operations
 * @access  Private (Operations staff only)
 */
router.get('/rooms-overview', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(`
      *,
      users!users_room_id_fkey(full_name, email, phone)
    `)
    .order('room_number');

  if (error) {
    throw new ValidationError('Failed to fetch rooms overview');
  }

  // Calculate occupancy statistics
  const stats = {
    totalRooms: rooms.length,
    occupiedRooms: rooms.filter(r => r.occupied > 0).length,
    availableRooms: rooms.filter(r => r.occupied < r.capacity).length,
    fullRooms: rooms.filter(r => r.occupied >= r.capacity).length,
    totalCapacity: rooms.reduce((sum, r) => sum + r.capacity, 0),
    totalOccupancy: rooms.reduce((sum, r) => sum + r.occupied, 0)
  };

  res.json({
    success: true,
    data: { rooms, stats }
  });
}));

module.exports = router;