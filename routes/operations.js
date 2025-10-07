const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check operations assistant role
const operationsMiddleware = async (req, res, next) => {
  try {
    // Get user profile from database to check role
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile) {
      throw new AuthorizationError('User profile not found');
    }

    if (!['hostel_operations_assistant', 'admin', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Operations access required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/operations/dashboard-stats
 * @desc    Get operations dashboard statistics
 * @access  Private (Operations staff only)
 */
router.get('/dashboard-stats', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get maintenance requests count
    const { count: maintenanceCount, error: maintenanceError } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('complaint_type', 'maintenance')
      .in('status', ['open', 'in_progress']);

    // Get pending room assignments
    const { count: assignmentsCount, error: assignmentsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .is('room_id', null);

    // Get today's check-ins (new users created today)
    const today = new Date().toISOString().split('T')[0];
    const { count: checkInsCount, error: checkInsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .gte('created_at', today);

    // Get available rooms count
    const { count: availableRooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available');

    res.json({
      success: true,
      data: {
        maintenanceRequests: maintenanceError ? 0 : (maintenanceCount || 0),
        pendingAssignments: assignmentsError ? 0 : (assignmentsCount || 0),
        todayCheckIns: checkInsError ? 0 : (checkInsCount || 0),
        availableRooms: roomsError ? 0 : (availableRooms || 0)
      }
    });
  } catch (error) {
    // Return empty data if any table is missing
    res.json({
      success: true,
      data: {
        maintenanceRequests: 0,
        pendingAssignments: 0,
        todayCheckIns: 0,
        availableRooms: 0
      }
    });
  }
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

  try {
    let query = supabase
      .from('complaints')
      .select(`
        *,
        users!complaints_user_id_fkey(full_name, email, phone),
        rooms(room_number, floor),
        assigned_to_user:users!complaints_assigned_to_fkey(full_name)
      `)
      .eq('complaint_type', 'maintenance')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: maintenanceRequests, error } = await query;

    res.json({
      success: true,
      data: {
        maintenanceRequests: error ? [] : (maintenanceRequests || []),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: error ? 0 : (maintenanceRequests?.length || 0)
        }
      }
    });
  } catch (error) {
    // Return empty data if table is missing
    res.json({
      success: true,
      data: {
        maintenanceRequests: [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: 0
        }
      }
    });
  }
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
    .eq('complaint_type', 'maintenance')
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

  try {
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

    // Get available rooms
    const { data: availableRooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'available')
      .lt('current_occupancy', supabase.raw('capacity'))
      .order('room_number');

    res.json({
      success: true,
      data: {
        unassignedStudents: error ? [] : (unassignedStudents || []),
        availableRooms: roomsError ? [] : (availableRooms || []),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: error ? 0 : (unassignedStudents?.length || 0)
        }
      }
    });
  } catch (error) {
    // Return empty data if tables are missing
    res.json({
      success: true,
      data: {
        unassignedStudents: [],
        availableRooms: [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: 0
        }
      }
    });
  }
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

  if (room.current_occupancy >= room.capacity) {
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
      current_occupancy: room.current_occupancy + 1,
      status: room.current_occupancy + 1 >= room.capacity ? 'occupied' : 'available'
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

  try {
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

    res.json({
      success: true,
      data: { recentCheckIns: error ? [] : (recentCheckIns || []) }
    });
  } catch (error) {
    // Return empty data if table is missing
    res.json({
      success: true,
      data: { recentCheckIns: [] }
    });
  }
}));

/**
 * @route   GET /api/operations/rooms-overview
 * @desc    Get rooms overview for operations
 * @access  Private (Operations staff only)
 */
router.get('/rooms-overview', authMiddleware, operationsMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        *,
        users!users_room_id_fkey(full_name, email, phone)
      `)
      .order('room_number');

    if (error) {
      // Return empty data if table is missing
      res.json({
        success: true,
        data: { 
          rooms: [],
          stats: {
            totalRooms: 0,
            occupiedRooms: 0,
            availableRooms: 0,
            fullRooms: 0,
            totalCapacity: 0,
            totalOccupancy: 0
          }
        }
      });
      return;
    }

    // Calculate occupancy statistics
    const stats = {
      totalRooms: rooms.length,
      occupiedRooms: rooms.filter(r => r.current_occupancy > 0).length,
      availableRooms: rooms.filter(r => r.current_occupancy < r.capacity).length,
      fullRooms: rooms.filter(r => r.current_occupancy >= r.capacity).length,
      totalCapacity: rooms.reduce((sum, r) => sum + r.capacity, 0),
      totalOccupancy: rooms.reduce((sum, r) => sum + r.current_occupancy, 0)
    };

    res.json({
      success: true,
      data: { rooms, stats }
    });
  } catch (error) {
    // Return empty data if any error occurs
    res.json({
      success: true,
      data: { 
        rooms: [],
        stats: {
          totalRooms: 0,
          occupiedRooms: 0,
          availableRooms: 0,
          fullRooms: 0,
          totalCapacity: 0,
          totalOccupancy: 0
        }
      }
    });
  }
}));

module.exports = router;