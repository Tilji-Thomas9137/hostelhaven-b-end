const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role (allow ops and warden as well for dashboard access)
const adminMiddleware = async (req, res, next) => {
  try {
    // Get user profile from database to check role
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'hostel_operations_assistant', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Admin access required');
  }
};

/**
 * @route   GET /api/admin/dashboard-stats
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin only)
 */
router.get('/dashboard-stats', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  try {
    const { count: totalStudents } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    // Total hostels count (for frontend hostels card)
    const { count: totalHostels } = await supabase
      .from('hostels')
      .select('*', { count: 'exact', head: true });

    let totalRevenue = 0;
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid');
    if (Array.isArray(revenueData)) {
      totalRevenue = revenueData.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }

    const { count: pendingComplaints } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']);

    const { data: occupancyData } = await supabase
      .from('rooms')
      .select('capacity, occupied');

    const totalCapacity = Array.isArray(occupancyData) ? occupancyData.reduce((s, r) => s + (r.capacity || 0), 0) : 0;
    const totalOccupancy = Array.isArray(occupancyData) ? occupancyData.reduce((s, r) => s + (r.occupied || 0), 0) : 0;
    const occupancyRate = totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalStudents: totalStudents || 0,
        totalRooms: totalRooms || 0,
        totalHostels: totalHostels || 0,
        totalRevenue: totalRevenue || 0,
        pendingComplaints: pendingComplaints || 0,
        occupancyRate: parseFloat(occupancyRate),
        totalCapacity,
        totalOccupancy
      }
    });
  } catch (e) {
    res.json({
      success: true,
      data: {
        totalStudents: 0,
        totalRooms: 0,
        totalRevenue: 0,
        pendingComplaints: 0,
        occupancyRate: 0,
        totalCapacity: 0,
        totalOccupancy: 0
      }
    });
  }
}));

/**
 * @route   GET /api/admin/hostels
 * @desc    Get all hostels with details
 * @access  Private (Admin only)
 */
router.get('/hostels', authMiddleware, adminMiddleware, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { limit = 20, offset = 0 } = req.query;

  const { data: hostels, error } = await supabase
    .from('hostels')
    .select(`
      *,
      rooms(count)
    `)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching hostels:', error);
    
    // If hostels table doesn't exist, return empty array instead of error
    if (error.code === '42P01') {
      return res.json({
        success: true,
        data: {
          hostels: [],
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: 0
          }
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hostels',
      error: error.message
    });
  }

  // Process hostels data
  const processedHostels = (hostels || []).map(hostel => ({
    ...hostel,
    roomCount: hostel.rooms?.[0]?.count || 0
  }));

  res.json({
    success: true,
    data: {
      hostels: processedHostels,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: processedHostels.length
      }
    }
  });
}));

/**
 * @route   POST /api/admin/hostels
 * @desc    Create new hostel
 * @access  Private (Admin only)
 */
router.post('/hostels', authMiddleware, adminMiddleware, [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('address').trim().isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('location').optional().trim().isLength({ max: 255 }).withMessage('Location must be less than 255 characters'),
  body('city').trim().isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }),
  body('country').optional().trim().isLength({ max: 100 }),
  body('postal_code').optional().trim().isLength({ max: 20 }),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail(),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { name, address, location, city, state, country, postal_code, phone, email, capacity } = req.body;

  const { data: hostel, error } = await supabase
    .from('hostels')
    .insert({
      name,
      address,
      location,
      city,
      state,
      country,
      postal_code,
      phone,
      email,
      capacity,
      occupancy: 0
    })
    .select()
    .single();

  if (error) {
    throw new ValidationError('Failed to create hostel');
  }

  res.status(201).json({
    success: true,
    message: 'Hostel created successfully',
    data: { hostel }
  });
}));

/**
 * @route   PUT /api/admin/hostels/:id
 * @desc    Update hostel
 * @access  Private (Admin only)
 */
router.put('/hostels/:id', authMiddleware, adminMiddleware, [
  body('name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('address').optional().trim().isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('location').optional().trim().isLength({ max: 255 }).withMessage('Location must be less than 255 characters'),
  body('city').optional().trim().isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }),
  body('pincode').optional().trim().isLength({ max: 10 }),
  body('contact_phone').optional().trim().isLength({ max: 20 }),
  body('contact_email').optional().isEmail().withMessage('Invalid email format'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  // Remove undefined values
  Object.keys(updates).forEach(key => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const { data: hostel, error } = await supabase
    .from('hostels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating hostel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update hostel',
      error: error.message
    });
  }

  if (!hostel) {
    return res.status(404).json({
      success: false,
      message: 'Hostel not found'
    });
  }

  res.json({
    success: true,
    message: 'Hostel updated successfully',
    data: { hostel }
  });
}));

/**
 * @route   DELETE /api/admin/hostels/:id
 * @desc    Delete hostel
 * @access  Private (Admin only)
 */
router.delete('/hostels/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('hostels')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting hostel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete hostel',
      error: error.message
    });
  }

  res.json({
    success: true,
    message: 'Hostel deleted successfully'
  });
}));

/**
 * @route   GET /api/admin/hostels/:id/rooms
 * @desc    Get rooms for a specific hostel
 * @access  Private (Admin only)
 */
router.get('/hostels/:id/rooms', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .order('room_number', { ascending: true });

  if (error) {
    console.error('Error fetching rooms:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }

  res.json({
    success: true,
    data: { rooms: rooms || [] }
  });
}));

/**
 * @route   GET /api/admin/students
 * @desc    Get all users with details (students, admins, wardens, etc.)
 * @access  Private (Admin only)
 */
router.get('/students', authMiddleware, adminMiddleware, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { limit = 20, offset = 0, search } = req.query;

  let query = supabase
    .from('users')
    .select(`
      *,
      user_profiles:user_profiles(user_id, admission_number, course, batch_year, avatar_url, status, profile_status)
    `)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }

  // Process user data and get room information separately
  const usersWithStatus = await Promise.all((students || []).map(async (user) => {
    let roomInfo = null;
    if (user.room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select('room_number, floor, room_type')
        .eq('id', user.room_id)
        .single();
      roomInfo = room;
    }
    
    return {
      ...user,
      roomNumber: roomInfo?.room_number || 'Not assigned',
      roomFloor: roomInfo?.floor || null,
      roomType: roomInfo?.room_type || null
    };
  }));

  res.json({
    success: true,
    data: {
      students: usersWithStatus,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: usersWithStatus.length
      }
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Update user status
 * @access  Private (Admin only)
 */
router.put('/users/:id/status', authMiddleware, adminMiddleware, [
  body('status').isIn(['available', 'unavailable', 'suspended', 'inactive']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status } = req.body;

  const { data: user, error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', id)
    .select('id, full_name, email, status')
    .single();

  if (error) {
    throw new ValidationError('Failed to update user status');
  }

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: { user }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (alias for students endpoint)
 * @access  Private (Admin only)
 */
router.get('/users', authMiddleware, adminMiddleware, [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['admin', 'student', 'warden', 'parent', 'hostel_operations_assistant']).withMessage('Invalid role filter')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { limit = 20, offset = 0, search = '', role = '' } = req.query;

  let query = supabase
    .from('users')
    .select(`
      *,
      user_profiles:user_profiles(user_id, admission_number, course, batch_year, avatar_url, status, profile_status)
    `)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  // Apply search filter
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply role filter
  if (role) {
    query = query.eq('role', role);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }

  // Process user data and get room information separately
  const usersWithStatus = await Promise.all((students || []).map(async (user) => {
    let roomInfo = null;
    if (user.room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select('room_number, floor, room_type, capacity, occupied')
        .eq('id', user.room_id)
        .single();
      roomInfo = room;
    }
    
    return {
      ...user,
      roomNumber: roomInfo?.room_number || 'Not assigned',
      roomFloor: roomInfo?.floor || null,
      roomType: roomInfo?.room_type || null,
      roomCapacity: roomInfo?.capacity || null,
      roomOccupied: roomInfo?.occupied || 0
    };
  }));

  res.json({
    success: true,
    data: {
      students: usersWithStatus,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: usersWithStatus.length
      }
    }
  });
}));

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user details
 * @access  Private (Admin only)
 */
router.get('/users/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // First get the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (userError || !user) {
    throw new ValidationError('User not found');
  }

  // Get user profile if exists
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', id)
    .single();

  // Get room info if user has a room
  let roomInfo = null;
  if (user.room_id) {
    const { data: room } = await supabase
      .from('rooms')
      .select('room_number, floor, room_type, capacity, occupied, price, amenities')
      .eq('id', user.room_id)
      .single();
    roomInfo = room;
  }

  // Combine all data
  const userWithDetails = {
    ...user,
    user_profiles: userProfile,
    rooms: roomInfo
  };

  res.json({
    success: true,
    data: { user: userWithDetails }
  });
}));

/**
 * @route   GET /api/admin/complaints
 * @desc    Get all complaints for admin review
 * @access  Private (Admin only)
 */
router.get('/complaints', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed']),
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
    .select('*')
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (priority) {
    query = query.eq('priority', priority);
  }

  const { data: complaints, error } = await query;

  if (error) {
    return res.json({
      success: true,
      data: {
        complaints: [],
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total: 0 }
      }
    });
  }

  res.json({
    success: true,
    data: {
      complaints,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: complaints.length
      }
    }
  });
}));

/**
 * @route   PUT /api/admin/complaints/:id/status
 * @desc    Update complaint status
 * @access  Private (Admin only)
 */
router.put('/complaints/:id/status', authMiddleware, adminMiddleware, [
  body('status').isIn(['pending', 'in_progress', 'resolved', 'closed']),
  body('resolution_notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status, resolution_notes } = req.body;

  const updates = {
    status,
    assigned_to: req.user.id
  };

  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString();
    if (resolution_notes) {
      updates.resolution_notes = resolution_notes;
    }
  }

  const { data: complaint, error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      users!complaints_user_id_fkey(full_name, email)
    `)
    .single();

  if (error) {
    throw new ValidationError('Failed to update complaint');
  }

  // Create notification for the student
  await supabase
    .from('notifications')
    .insert({
      user_id: complaint.user_id,
      title: 'Complaint Status Updated',
      message: `Your complaint "${complaint.title}" has been ${status}`,
      type: 'complaint'
    });

  res.json({
    success: true,
    message: 'Complaint status updated successfully',
    data: { complaint }
  });
}));

/**
 * @route   GET /api/admin/analytics
 * @desc    Get analytics data for admin dashboard
 * @access  Private (Admin only)
 */
router.get('/analytics', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  // Get monthly registration trends
  const { data: monthlyRegistrations, error: regError } = await supabase
    .from('users')
    .select('created_at')
    .eq('role', 'student')
    .gte('created_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString());

  // Get monthly revenue trends
  const { data: monthlyRevenue, error: revError } = await supabase
    .from('payments')
    .select('amount, paid_date')
    .eq('status', 'paid')
    .gte('paid_date', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString());

  // Get complaint trends by category
  const { data: complaintsByCategory, error: compError } = await supabase
    .from('complaints')
    .select('category')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const analytics = {
    monthlyRegistrations: monthlyRegistrations || [],
    monthlyRevenue: monthlyRevenue || [],
    complaintsByCategory: complaintsByCategory || []
  };

  res.json({
    success: true,
    data: { analytics }
  });
}));

module.exports = router;
/**
 * @route   GET /api/admin/leave-requests
 * @desc    Get all leave requests for admin review
 * @access  Private (Admin only)
 */
router.get('/leave-requests', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: leaveRequests, error } = await query;

  if (error) {
    return res.json({
      success: true,
      data: {
        leaveRequests: [],
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total: 0 }
      }
    });
  }

  res.json({
    success: true,
    data: {
      leaveRequests,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: leaveRequests.length
      }
    }
  });
}));

/**
 * @route   PUT /api/admin/leave-requests/:id/status
 * @desc    Update leave request status (approve/reject)
 * @access  Private (Admin only)
 */
router.put('/leave-requests/:id/status', authMiddleware, adminMiddleware, [
  body('status').isIn(['approved', 'rejected']),
  body('notes').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { status, notes } = req.body;

  const updates = { status, approved_by: req.user.id };
  if (status === 'approved') {
    updates.approved_at = new Date().toISOString();
  }
  if (notes) updates.notes = notes;

  const { data: leaveRequest, error } = await supabase
    .from('leave_requests')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !leaveRequest) {
    throw new ValidationError('Failed to update leave request');
  }

  // Notify the user
  await supabase
    .from('notifications')
    .insert({
      user_id: leaveRequest.user_id,
      title: 'Leave Request Updated',
      message: `Your leave request has been ${status}.`,
      type: 'leave'
    });

  res.json({
    success: true,
    message: 'Leave request status updated successfully',
    data: { leaveRequest }
  });
}));
/**
 * @route   GET /api/admin/payments
 * @desc    Get payments across all students (admin view)
 * @access  Private (Admin only)
 */
router.get('/payments', authMiddleware, adminMiddleware, [
  query('status').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { status, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('payments')
    .select('*')
    .order('due_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: payments, error } = await query;

  if (error) {
    return res.json({
      success: true,
      data: {
        payments: [],
        pagination: { limit: parseInt(limit), offset: parseInt(offset), total: 0 }
      }
    });
  }

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: payments.length
      }
    }
  });
}));

/**
 * @route   PUT /api/admin/payments/:id/mark-paid
 * @desc    Mark a payment as paid (admin action)
 * @access  Private (Admin only)
 */
router.put('/payments/:id/mark-paid', authMiddleware, adminMiddleware, [
  body('payment_method').optional().isIn(['online', 'card', 'bank_transfer']),
  body('transaction_id').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { payment_method = 'card', transaction_id } = req.body;

  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !payment) {
    throw new ValidationError('Payment not found');
  }

  const { data: updatedPayment, error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      payment_method,
      transaction_id: transaction_id || `ADMIN_${Date.now()}`,
      paid_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    throw new ValidationError('Failed to update payment');
  }

  // Notify the user
  await supabase
    .from('notifications')
    .insert({
      user_id: payment.user_id,
      title: 'Payment Recorded',
      message: `Your payment of $${payment.amount} has been marked as paid by admin.`,
      type: 'payment'
    });

  res.json({
    success: true,
    message: 'Payment marked as paid',
    data: { payment: updatedPayment }
  });
}));