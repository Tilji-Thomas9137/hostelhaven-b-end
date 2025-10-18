const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check student access
const studentMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role, status')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'student') {
      throw new AuthorizationError('Student access required');
    }

    if (userProfile.status === 'inactive' || userProfile.status === 'suspended') {
      throw new AuthorizationError('Your account is currently inactive. Please contact an administrator to activate your account.');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Student access required');
  }
};

/**
 * @route   GET /api/student-complaints
 * @desc    Get student's complaints
 * @access  Private (Student)
 */
router.get('/', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get user's ID
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Fetch complaints for the user
    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', userRow.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching complaints:', error);
      throw new ValidationError('Failed to fetch complaints');
    }

    res.json({
      success: true,
      data: { 
        complaints: complaints || []
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/student-complaints
 * @desc    Create a new complaint
 * @access  Private (Student)
 */
router.post('/', authMiddleware, studentMiddleware, [
  body('title').isString().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').isString().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('category').isIn(['maintenance', 'cleanliness', 'noise', 'security', 'food', 'other']).withMessage('Invalid category'),
  body('priority').isIn(['low', 'medium', 'high']).withMessage('Invalid priority')
], asyncHandler(async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError(errors.array()[0].msg);
    }

    const { title, description, category, priority } = req.body;

    // Get user's ID and profile
    const { data: userRow } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Check if user has too many pending complaints (max 3)
    const { data: pendingComplaints } = await supabase
      .from('complaints')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('status', 'pending');

    if (pendingComplaints && pendingComplaints.length >= 3) {
      throw new ValidationError('You can have maximum 3 pending complaints at a time.');
    }

    // Create the complaint
    const { data: complaint, error } = await supabase
      .from('complaints')
      .insert({
        user_id: userRow.id,
        student_name: userRow.full_name,
        student_email: userRow.email,
        title,
        description,
        category,
        priority,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating complaint:', error);
      throw new ValidationError('Failed to create complaint');
    }

    // Notify staff about the new complaint
    try {
      const { data: staffList } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['admin', 'warden', 'hostel_operations_assistant']);

      const notifications = (staffList || []).map((staffUser) => ({
        user_id: staffUser.id,
        type: 'complaint',
        title: 'New Complaint',
        message: `${userRow.full_name} has submitted a ${priority} priority complaint: ${title}`,
        metadata: {
          complaint_id: complaint.id,
          student_id: userRow.id,
          category,
          priority,
          title
        },
        is_read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      data: { complaint },
      message: 'Complaint submitted successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/student-complaints/:id/cancel
 * @desc    Cancel a complaint (only if pending)
 * @access  Private (Student)
 */
router.put('/:id/cancel', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's ID
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', req.user.id)
      .single();

    if (!userRow) {
      throw new ValidationError('User not found');
    }

    // Check if the complaint exists and belongs to the user
    const { data: complaint, error: fetchError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', id)
      .eq('user_id', userRow.id)
      .single();

    if (fetchError || !complaint) {
      throw new ValidationError('Complaint not found');
    }

    if (complaint.status !== 'pending') {
      throw new ValidationError('Only pending complaints can be cancelled');
    }

    // Update the complaint status
    const { error: updateError } = await supabase
      .from('complaints')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error cancelling complaint:', updateError);
      throw new ValidationError('Failed to cancel complaint');
    }

    res.json({
      success: true,
      message: 'Complaint cancelled successfully!'
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
