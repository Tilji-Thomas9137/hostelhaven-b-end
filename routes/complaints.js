const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/complaints/summary
 * @desc    Get complaints summary for dashboard
 * @access  Private
 */
router.get('/summary', authMiddleware, asyncHandler(async (req, res) => {
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select('status, category, created_at')
    .eq('user_id', req.user.id);

  if (error) {
    throw new ValidationError('Failed to fetch complaints summary');
  }

  const summary = {
    total: complaints.length,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    by_category: {}
  };

  complaints.forEach(complaint => {
    summary[complaint.status] = (summary[complaint.status] || 0) + 1;
    summary.by_category[complaint.category] = (summary.by_category[complaint.category] || 0) + 1;
  });

  res.json({
    success: true,
    data: { summary }
  });
}));

/**
 * @route   GET /api/complaints
 * @desc    Get user's complaints
 * @access  Private
 */
router.get('/', authMiddleware, [
  query('status').optional().isIn(['pending', 'in_progress', 'resolved', 'closed']),
  query('category').optional().isIn(['maintenance', 'cleanliness', 'noise', 'security', 'food', 'wifi', 'general']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  // First ensure user exists in our database
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', req.user.id)
    .single();

  if (userError) {
    console.error('User fetch error:', userError);
    // Create user profile if it doesn't exist
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
  }

  const { status, category, limit = 10, offset = 0 } = req.query;
  
  let query = supabase
    .from('complaints')
    .select(`
      *,
      rooms(room_number, floor),
      assigned_to_user:users!complaints_assigned_to_fkey(full_name, role)
    `)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: complaints, error } = await query;

  if (error) {
    console.error('Complaints fetch error:', error);
    // If it's a permission error, return empty array
    if (error.code === 'PGRST301') {
      return res.json({
        success: true,
        data: {
          complaints: [],
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: 0
          }
        }
      });
    }
    throw new ValidationError('Failed to fetch complaints');
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
 * @route   GET /api/complaints/:id
 * @desc    Get specific complaint details
 * @access  Private
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: complaint, error } = await supabase
    .from('complaints')
    .select(`
      *,
      rooms(room_number, floor, room_type),
      assigned_to_user:users!complaints_assigned_to_fkey(full_name, role, email)
    `)
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !complaint) {
    throw new ValidationError('Complaint not found');
  }

  res.json({
    success: true,
    data: { complaint }
  });
}));

/**
 * @route   POST /api/complaints
 * @desc    Create new complaint
 * @access  Private
 */
router.post('/', authMiddleware, [
  body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Title must be between 5 and 255 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('category').isIn(['maintenance', 'cleanliness', 'noise', 'security', 'food', 'wifi', 'general']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { title, description, category, priority = 'medium' } = req.body;

  // Get user's hostel and room info
  console.log('Getting user info for user ID:', req.user.id);
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('hostel_id, room_id')
    .eq('id', req.user.id)
    .single();

  console.log('User data:', user);
  console.log('User error:', userError);

  if (userError) {
    console.error('User error details:', userError);
    throw new ValidationError('Failed to get user information');
  }

  // Prepare complaint data - only include hostel_id and room_id if they exist
  const complaintData = {
    user_id: req.user.id,
    title,
    description,
    category,
    priority,
    status: 'pending'
  };

  // Only add hostel_id and room_id if they exist
  if (user.hostel_id) {
    complaintData.hostel_id = user.hostel_id;
  }
  if (user.room_id) {
    complaintData.room_id = user.room_id;
  }

  console.log('Inserting complaint with data:', complaintData);

  const { data: complaint, error } = await supabase
    .from('complaints')
    .insert(complaintData)
    .select(`
      *,
      rooms(room_number, floor)
    `)
    .single();

  console.log('Complaint insertion result:', { complaint, error });

  if (error) {
    console.error('Complaint insertion error:', error);
    throw new ValidationError('Failed to create complaint');
  }

  // Create notification for hostel staff (only if user has a hostel assigned)
  if (user.hostel_id) {
    try {
      // Get hostel staff (wardens and operations assistants)
      const { data: staff } = await supabase
        .from('users')
        .select('id')
        .eq('hostel_id', user.hostel_id)
        .in('role', ['warden', 'hostel_operations_assistant']);

      if (staff && staff.length > 0) {
        const notifications = staff.map(staffMember => ({
          user_id: staffMember.id,
          title: 'New Complaint Submitted',
          message: `A new ${category} complaint has been submitted: ${title}`,
          type: 'complaint'
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }
    } catch (notificationError) {
      console.error('Error creating hostel staff notifications:', notificationError);
      // Don't fail the complaint creation if notifications fail
    }
  }

  // Also notify all admins
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        user_id: admin.id,
        title: 'New Complaint Submitted',
        message: `A new ${category} complaint has been submitted: ${title}`,
        type: 'complaint'
      }));

      await supabase
        .from('notifications')
        .insert(adminNotifications);
    }
  } catch (adminNotificationError) {
    console.error('Error creating admin notifications:', adminNotificationError);
    // Don't fail the complaint creation if admin notifications fail
  }

  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully',
    data: { complaint }
  });
}));

/**
 * @route   PUT /api/complaints/:id
 * @desc    Update complaint (only if pending)
 * @access  Private
 */
router.put('/:id', authMiddleware, [
  body('title').optional().trim().isLength({ min: 5, max: 255 }),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }),
  body('category').optional().isIn(['maintenance', 'cleanliness', 'noise', 'security', 'food', 'wifi', 'general']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { title, description, category, priority } = req.body;

  // Check if complaint exists and belongs to user
  const { data: existingComplaint, error: fetchError } = await supabase
    .from('complaints')
    .select('status')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError) {
    console.error('Complaint fetch error:', fetchError);
    if (fetchError.code === 'PGRST116') {
      throw new ValidationError('Complaint not found');
    }
    throw new ValidationError('Failed to fetch complaint');
  }

  if (!existingComplaint) {
    throw new ValidationError('Complaint not found');
  }

  if (existingComplaint.status !== 'pending') {
    throw new ValidationError('Cannot update complaint that is already being processed');
  }

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;
  if (category) updates.category = category;
  if (priority) updates.priority = priority;

  const { data: complaint, error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      hostels(name, city),
      rooms(room_number, floor)
    `)
    .single();

  if (error) {
    console.error('Complaint update error:', error);
    throw new ValidationError('Failed to update complaint');
  }

  if (!complaint) {
    throw new ValidationError('Complaint not found after update');
  }

  res.json({
    success: true,
    message: 'Complaint updated successfully',
    data: { complaint }
  });
}));

/**
 * @route   DELETE /api/complaints/:id
 * @desc    Delete complaint (only if pending)
 * @access  Private
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if complaint exists and belongs to user
  const { data: existingComplaint, error: fetchError } = await supabase
    .from('complaints')
    .select('status')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !existingComplaint) {
    throw new ValidationError('Complaint not found');
  }

  if (existingComplaint.status !== 'pending') {
    throw new ValidationError('Cannot delete complaint that is already being processed');
  }

  const { error } = await supabase
    .from('complaints')
    .delete()
    .eq('id', id);

  if (error) {
    throw new ValidationError('Failed to delete complaint');
  }

  res.json({
    success: true,
    message: 'Complaint deleted successfully'
  });
}));

module.exports = router;