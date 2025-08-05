const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/hostels
 * @desc    Get all hostels
 * @access  Public
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, city, state, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('hostels')
      .select('*', { count: 'exact' });

    // Apply filters
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    if (state) {
      query = query.ilike('state', `%${state}%`);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: hostels, error, count } = await query;

    if (error) {
      throw new ValidationError('Failed to fetch hostels');
    }

    res.json({
      success: true,
      data: {
        hostels,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/hostels/:id
 * @desc    Get hostel by ID
 * @access  Public
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { data: hostel, error } = await supabase
      .from('hostels')
      .select(`
        *,
        rooms(
          id,
          room_number,
          floor,
          room_type,
          capacity,
          current_occupancy,
          status,
          rent_amount
        )
      `)
      .eq('id', id)
      .single();

    if (error || !hostel) {
      throw new NotFoundError('Hostel not found');
    }

    res.json({
      success: true,
      data: { hostel }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/hostels
 * @desc    Create new hostel (Admin only)
 * @access  Private
 */
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Hostel name must be between 2 and 100 characters'),
  body('address')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  body('city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('totalRooms')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total rooms must be a positive integer')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const {
    name,
    address,
    city,
    state,
    country = 'India',
    postalCode,
    phone,
    email,
    website,
    description,
    totalRooms = 0,
    availableRooms = 0,
    amenities = [],
    rules = []
  } = req.body;

  try {
    const { data: hostel, error } = await supabase
      .from('hostels')
      .insert({
        name,
        address,
        city,
        state,
        country,
        postal_code: postalCode,
        phone,
        email,
        website,
        description,
        total_rooms: totalRooms,
        available_rooms: availableRooms,
        amenities,
        rules
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
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/hostels/:id
 * @desc    Update hostel (Admin only)
 * @access  Private
 */
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Hostel name must be between 2 and 100 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Address must be between 10 and 200 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
], asyncHandler(async (req, res) => {
  // Check for validation errors
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

  try {
    const { data: hostel, error } = await supabase
      .from('hostels')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !hostel) {
      throw new NotFoundError('Hostel not found');
    }

    res.json({
      success: true,
      message: 'Hostel updated successfully',
      data: { hostel }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   DELETE /api/hostels/:id
 * @desc    Delete hostel (Admin only)
 * @access  Private
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('hostels')
      .delete()
      .eq('id', id);

    if (error) {
      throw new NotFoundError('Hostel not found');
    }

    res.json({
      success: true,
      message: 'Hostel deleted successfully'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/hostels/:id/rooms
 * @desc    Get rooms for a specific hostel
 * @access  Public
 */
router.get('/:id/rooms', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, roomType, available } = req.query;

  try {
    let query = supabase
      .from('rooms')
      .select(`
        *,
        users(full_name, email)
      `)
      .eq('hostel_id', id);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (roomType) {
      query = query.eq('room_type', roomType);
    }
    if (available === 'true') {
      query = query.eq('status', 'available');
    }

    const { data: rooms, error } = await query;

    if (error) {
      throw new ValidationError('Failed to fetch rooms');
    }

    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/hostels/:id/statistics
 * @desc    Get hostel statistics
 * @access  Public
 */
router.get('/:id/statistics', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Get hostel info
    const { data: hostel, error: hostelError } = await supabase
      .from('hostels')
      .select('total_rooms, available_rooms')
      .eq('id', id)
      .single();

    if (hostelError || !hostel) {
      throw new NotFoundError('Hostel not found');
    }

    // Get room statistics
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('status, room_type')
      .eq('hostel_id', id);

    if (roomsError) {
      throw new ValidationError('Failed to fetch room statistics');
    }

    // Calculate statistics
    const stats = {
      totalRooms: hostel.total_rooms,
      availableRooms: hostel.available_rooms,
      occupiedRooms: hostel.total_rooms - hostel.available_rooms,
      occupancyRate: ((hostel.total_rooms - hostel.available_rooms) / hostel.total_rooms * 100).toFixed(1),
      roomTypes: {},
      statusBreakdown: {}
    };

    // Count room types
    rooms.forEach(room => {
      stats.roomTypes[room.room_type] = (stats.roomTypes[room.room_type] || 0) + 1;
      stats.statusBreakdown[room.status] = (stats.statusBreakdown[room.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: { statistics: stats }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router; 