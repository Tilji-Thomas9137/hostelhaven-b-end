const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Broadcast a payment due notification to student and parent by admission number
router.post('/broadcast-payment-due', authMiddleware, [
  body('admission_number').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('payment_type').notEmpty(),
  body('payment_id').notEmpty(),
  body('due_date').notEmpty(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { admission_number, amount, payment_type, payment_id, due_date } = req.body;

  // Find the student user by admission number
  const { data: studentUser, error: studentErr } = await supabase
    .from('users')
    .select('id')
    .eq('admission_number', admission_number)
    .single();

  if (studentErr || !studentUser) {
    throw new ValidationError('Student not found for admission number');
  }

  const notifications = [];

  // Notify student
  notifications.push({
    user_id: studentUser.id,
    title: 'Payment Due',
    message: `₹${amount} due for ${payment_type.replace('_',' ')} (ID: ${payment_id}) by ${new Date(due_date).toLocaleDateString()}`,
    type: 'payment_due'
  });

  // Find parent linked to this student
  const { data: parentLink } = await supabase
    .from('parents')
    .select('user_id, verified')
    .eq('student_profile_id', studentUser.id)
    .single();

  if (parentLink && parentLink.user_id && parentLink.verified) {
    notifications.push({
      user_id: parentLink.user_id,
      title: 'Child Payment Due',
      message: `₹${amount} due for ${payment_type.replace('_',' ')} (ID: ${payment_id}) by ${new Date(due_date).toLocaleDateString()}`,
      type: 'payment_due'
    });
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }

  res.json({ success: true, message: 'Notifications queued' });
}));

// Additional notification routes
/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authMiddleware, [
  query('is_read').optional().isBoolean(),
  // Allow additional types used by frontend
  query('type').optional().isIn(['payment', 'payment_due', 'room_allocation', 'complaint', 'leave', 'maintenance', 'general']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { is_read, type, limit = 20, offset = 0 } = req.query;
  
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (is_read !== undefined) {
    query = query.eq('is_read', is_read === 'true');
  }

  if (type) {
    query = query.eq('type', type);
  }

  const { data: notifications, error } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch notifications');
  }

  res.json({
    success: true,
    data: {
      notifications,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: notifications.length
      }
    }
  });
}));

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: notification, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error || !notification) {
    throw new ValidationError('Notification not found');
  }

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: { notification }
  });
}));
// include payment_due and room_allocation
query('type').optional().isIn(['payment', 'payment_due', 'room_allocation', 'complaint', 'leave', 'maintenance', 'general']),

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', authMiddleware, asyncHandler(async (req, res) => {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false)
    .select();

  if (error) {
    throw new ValidationError('Failed to mark notifications as read');
  }

  res.json({
    success: true,
    message: `${notifications.length} notifications marked as read`,
    data: { count: notifications.length }
  });
}));

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) {
    throw new ValidationError('Failed to delete notification');
  }

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
}));

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', authMiddleware, asyncHandler(async (req, res) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false);

  if (error) {
    throw new ValidationError('Failed to fetch unread count');
  }

  res.json({
    success: true,
    data: { unreadCount: count }
  });
}));

/**
 * @route   POST /api/notifications/send-to-admin
 * @desc    Send notification from staff (warden/operations) to admin
 * @access  Private (Staff)
 */
router.post('/send-to-admin', authMiddleware, [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['room_request', 'complaint', 'leave', 'maintenance', 'general']).withMessage('Invalid notification type'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { title, message, type = 'general', metadata = {} } = req.body;

  try {
    // Get the sender's information
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (senderError || !sender) {
      throw new ValidationError('Sender not found');
    }

    // Check if sender is staff (warden or operations assistant)
    if (!['warden', 'hostel_operations_assistant'].includes(sender.role)) {
      throw new ValidationError('Only wardens and operations assistants can send notifications to admin');
    }

    // Find all admin users
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active');

    if (adminError) {
      throw new Error(`Failed to fetch admin users: ${adminError.message}`);
    }

    if (!admins || admins.length === 0) {
      throw new ValidationError('No active admin users found');
    }

    // Create notifications for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message: `${message} (From: ${sender.full_name} - ${sender.role.replace('_', ' ')})`,
      type,
      metadata: {
        ...metadata,
        sender_id: sender.id,
        sender_name: sender.full_name,
        sender_role: sender.role
      },
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { data: insertedNotifications, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      throw new Error(`Failed to create notifications: ${insertError.message}`);
    }

    res.json({
      success: true,
      message: `Notification sent to ${admins.length} admin(s)`,
      data: {
        notifications: insertedNotifications,
        recipient_count: admins.length
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;