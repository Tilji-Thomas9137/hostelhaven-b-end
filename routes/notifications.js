const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authMiddleware, [
  query('is_read').optional().isBoolean(),
  query('type').optional().isIn(['payment', 'complaint', 'leave', 'maintenance', 'general']),
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

module.exports = router;