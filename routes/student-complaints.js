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
  body('title').trim().notEmpty().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().notEmpty().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').trim().notEmpty().isIn([
    'maintenance', 'cleanliness', 'noise', 'security', 'food', 'other',
    'wifi_issue', 'bathroom_dirt', 'electric', 'plumbing', 'mess_food_quality'
  ]).withMessage('Invalid category'),
  body('priority').trim().notEmpty().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
], asyncHandler(async (req, res) => {
  try {
    // Log incoming request for debugging
    console.log('📝 Complaint submission request:', {
      body: req.body,
      user: req.user?.id
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Validation errors:', errors.array());
      throw new ValidationError(errors.array()[0].msg, errors.array());
    }

    let { title, description, category, priority } = req.body;
    
    // Trim and ensure all fields are strings
    title = String(title || '').trim();
    description = String(description || '').trim();
    category = String(category || '').trim();
    priority = String(priority || '').trim();

    // Map frontend categories to backend categories if needed
    const categoryMap = {
      'wifi_issue': 'maintenance',
      'bathroom_dirt': 'cleanliness',
      'electric': 'maintenance',
      'plumbing': 'maintenance',
      'mess_food_quality': 'food'
    };
    
    if (categoryMap[category]) {
      category = categoryMap[category];
    }

    // Ensure priority is valid (map 'urgent' to 'high' if backend doesn't support it)
    if (priority === 'urgent') {
      priority = 'high';
    }

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
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new ValidationError(error.message || `Failed to create complaint: ${error.code || 'Unknown error'}`);
    }

    // Notify staff and parents about the new complaint
    try {
      // Notify staff (admin, warden, hostel operations assistant)
      const { data: staffList } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['admin', 'warden', 'hostel_operations_assistant']);

      const staffNotifications = (staffList || []).map((staffUser) => ({
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

      // Notify parents of the student
      // First, get the student's profile ID
      const { data: studentProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userRow.id)
        .single();

      let parentNotifications = [];
      if (studentProfile) {
        // Get verified parents linked to this student
        const { data: parentRecords } = await supabase
          .from('parents')
          .select('user_id')
          .eq('student_profile_id', studentProfile.id)
          .eq('verified', true);

        if (parentRecords && parentRecords.length > 0) {
          // Get parent user IDs
          const parentIds = parentRecords.map(p => p.user_id);
          const { data: parentUsers } = await supabase
            .from('users')
            .select('id')
            .in('id', parentIds);
          
          if (parentUsers) {
            parentNotifications = parentUsers.map((parentUser) => ({
              user_id: parentUser.id,
              type: 'complaint',
              title: 'New Complaint from Student',
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
          }
        }
      }

      // Insert all notifications
      const allNotifications = [...staffNotifications, ...parentNotifications];
      if (allNotifications.length > 0) {
        await supabase.from('notifications').insert(allNotifications);
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
