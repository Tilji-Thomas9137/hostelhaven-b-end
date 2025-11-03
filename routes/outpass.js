const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// Create a service role client for bypassing RLS
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

/**
 * POST /api/outpass/create
 * Create a new outpass request
 */
router.post('/create', authMiddleware, asyncHandler(async (req, res) => {
  const authUserId = req.user.id;
  const {
    reason,
    destination,
    start_date,
    end_date,
    start_time,
    end_time,
    transport_mode,
    emergency_contact,
    emergency_phone,
    parent_approval
  } = req.body;

  // Validate required fields
  if (!reason || !destination || !start_date || !end_date || !start_time || !end_time || !transport_mode || !emergency_contact) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be provided'
    });
  }

  // Validate parent approval
  if (!parent_approval) {
    return res.status(400).json({
      success: false,
      message: 'Parent approval is required'
    });
  }

  try {
    // Get user's database ID from auth_uid
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', authUserId)
      .single();

    if (userError || !userRow) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is a student
    if (userRow.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can create outpass requests'
      });
    }

    // Check weekly outpass limit (3 per week)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: weeklyOutpasses, error: weeklyError } = await supabaseAdmin
      .from('outpass_requests')
      .select('id')
      .eq('user_id', userRow.id)
      .gte('created_at', startOfWeek.toISOString())
      .in('status', ['pending', 'approved', 'completed']); // Count active outpasses

    if (weeklyError) {
      console.error('Error checking weekly limit:', weeklyError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check outpass limit'
      });
    }

    if (weeklyOutpasses && weeklyOutpasses.length >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Weekly outpass limit reached. You can only request 3 outpasses per week.',
        error: 'WEEKLY_LIMIT_EXCEEDED'
      });
    }

    // Use the database function to create outpass request
    const { data, error } = await supabaseAdmin.rpc('create_outpass_request', {
      p_user_id: userRow.id, // Use database user ID, not auth ID
      p_reason: reason,
      p_destination: destination,
      p_start_date: start_date,
      p_end_date: end_date,
      p_start_time: start_time,
      p_end_time: end_time,
      p_transport_mode: transport_mode,
      p_emergency_contact: emergency_contact,
      p_emergency_phone: emergency_phone || null,
      p_parent_approval: parent_approval
    });

    if (error) {
      console.error('Error creating outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create outpass request',
        error: error.message
      });
    }

    // Get the created outpass request with details
    const { data: outpassDetails, error: detailsError } = await supabaseAdmin
      .from('outpass_requests')
      .select(`
        id,
        reason,
        destination,
        start_date,
        end_date,
        start_time,
        end_time,
        transport_mode,
        emergency_contact,
        emergency_phone,
        parent_approval,
        status,
        created_at,
        room_id,
        rooms!outpass_requests_room_id_fkey(room_number, building_id),
        buildings!rooms_building_id_fkey(building_name)
      `)
      .eq('id', data)
      .single();

    if (detailsError) {
      console.warn('Could not fetch outpass details:', detailsError);
      // Still return success with basic data
      res.status(201).json({
        success: true,
        message: 'Outpass request created successfully',
        data: { outpass_id: data }
      });
    } else {
      res.status(201).json({
        success: true,
        message: 'Outpass request created successfully',
        data: outpassDetails
      });
    }

  } catch (error) {
    console.error('Exception creating outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create outpass request',
      error: error.message
    });
  }
}));

/**
 * GET /api/outpass/weekly-count
 * Get current user's weekly outpass count
 */
router.get('/weekly-count', authMiddleware, asyncHandler(async (req, res) => {
  const authUserId = req.user.id;

  try {
    // Get user's database ID from auth_uid
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUserId)
      .single();

    if (userError || !userRow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate start of current week
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get weekly outpass count
    const { data: weeklyOutpasses, error: weeklyError } = await supabaseAdmin
      .from('outpass_requests')
      .select('id, status, created_at')
      .eq('user_id', userRow.id)
      .gte('created_at', startOfWeek.toISOString())
      .in('status', ['pending', 'approved', 'completed']);

    if (weeklyError) {
      console.error('Error fetching weekly count:', weeklyError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch weekly count'
      });
    }

    const count = weeklyOutpasses ? weeklyOutpasses.length : 0;
    const limit = 3;
    const remaining = Math.max(0, limit - count);

    res.json({
      success: true,
      data: {
        count,
        limit,
        remaining,
        canRequest: count < limit,
        weeklyOutpasses: weeklyOutpasses || []
      }
    });

  } catch (error) {
    console.error('Exception fetching weekly count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly count',
      error: error.message
    });
  }
}));

/**
 * GET /api/outpass/my-requests
 * Get current user's outpass requests
 */
router.get('/my-requests', authMiddleware, asyncHandler(async (req, res) => {
  const authUserId = req.user.id;

  try {
    // Get user's database ID from auth_uid
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', authUserId)
      .single();

    if (userError || !userRow) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Use direct query instead of broken RPC function
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .select(`
        id,
        user_id,
        reason,
        destination,
        start_date,
        end_date,
        start_time,
        end_time,
        transport_mode,
        emergency_contact,
        emergency_phone,
        parent_approval,
        status,
        approved_by,
        approved_at,
        rejection_reason,
        created_at,
        updated_at,
        users!outpass_requests_user_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('user_id', userRow.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outpass requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch outpass requests',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Exception fetching outpass requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outpass requests',
      error: error.message
    });
  }
}));

/**
 * GET /api/outpass/all
 * Get all outpass requests (for wardens and admins)
 */
router.get('/all', authMiddleware, authorize(['warden', 'admin']), asyncHandler(async (req, res) => {
  try {
    // Use direct query instead of broken RPC function
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .select(`
        id,
        user_id,
        reason,
        destination,
        start_date,
        end_date,
        start_time,
        end_time,
        transport_mode,
        emergency_contact,
        emergency_phone,
        parent_approval,
        status,
        approved_by,
        approved_at,
        rejection_reason,
        created_at,
        updated_at,
        users!outpass_requests_user_id_fkey(
          id,
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all outpass requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch outpass requests',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Exception fetching all outpass requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outpass requests',
      error: error.message
    });
  }
}));

/**
 * GET /api/outpass/pending
 * Get pending outpass requests (for wardens and admins)
 */
router.get('/pending', authMiddleware, authorize(['warden', 'admin']), asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .select(`
        *,
        users!outpass_requests_user_id_fkey(full_name, email),
        rooms!outpass_requests_room_id_fkey(room_number, building_id),
        buildings!rooms_building_id_fkey(building_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending outpass requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending outpass requests',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Exception fetching pending outpass requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending outpass requests',
      error: error.message
    });
  }
}));

/**
 * PUT /api/outpass/:id/approve
 * Approve an outpass request
 */
router.put('/:id/approve', authMiddleware, authorize(['warden', 'admin']), asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const userId = req.user.id;

  try {
    const { data, error } = await supabaseAdmin.rpc('update_outpass_status', {
      p_outpass_id: outpassId,
      p_status: 'approved',
      p_approved_by: userId,
      p_rejection_reason: null
    });

    if (error) {
      console.error('Error approving outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to approve outpass request',
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    res.json({
      success: true,
      message: 'Outpass request approved successfully'
    });

  } catch (error) {
    console.error('Exception approving outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve outpass request',
      error: error.message
    });
  }
}));

/**
 * PUT /api/outpass/:id/reject
 * Reject an outpass request
 */
router.put('/:id/reject', authMiddleware, authorize(['warden', 'admin']), asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const userId = req.user.id;
  const { rejection_reason } = req.body;

  if (!rejection_reason || rejection_reason.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required'
    });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('update_outpass_status', {
      p_outpass_id: outpassId,
      p_status: 'rejected',
      p_approved_by: userId,
      p_rejection_reason: rejection_reason.trim()
    });

    if (error) {
      console.error('Error rejecting outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reject outpass request',
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    res.json({
      success: true,
      message: 'Outpass request rejected successfully'
    });

  } catch (error) {
    console.error('Exception rejecting outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject outpass request',
      error: error.message
    });
  }
}));

/**
 * PUT /api/outpass/:id/complete
 * Mark an outpass request as completed (student returned)
 */
router.put('/:id/complete', authMiddleware, authorize(['warden', 'admin']), asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const userId = req.user.id;
  const { actual_return_date, actual_return_time } = req.body;

  try {
    // Update the outpass request to completed status
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .update({
        status: 'completed',
        actual_return_date: actual_return_date || new Date().toISOString().split('T')[0],
        actual_return_time: actual_return_time || new Date().toTimeString().split(' ')[0],
        is_returned: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', outpassId)
      .eq('status', 'approved') // Only allow completion of approved requests
      .select();

    if (error) {
      console.error('Error completing outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to complete outpass request',
        error: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Approved outpass request not found'
      });
    }

    res.json({
      success: true,
      message: 'Outpass request marked as completed successfully'
    });

  } catch (error) {
    console.error('Exception completing outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete outpass request',
      error: error.message
    });
  }
}));

/**
 * PUT /api/outpass/:id/cancel
 * Cancel an outpass request (student can cancel their own pending requests)
 */
router.put('/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const authUserId = req.user.id;
  const userRole = req.user.role;

  try {
    // Get user's database ID from auth_uid
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_uid', authUserId)
      .single();

    if (userError || !userRow) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user owns the request or is admin/warden
    const { data: outpassData, error: fetchError } = await supabaseAdmin
      .from('outpass_requests')
      .select('user_id, status')
      .eq('id', outpassId)
      .single();

    if (fetchError) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    // Check permissions
    const isOwner = outpassData.user_id === userRow.id; // Use database user ID
    const isAdminOrWarden = ['admin', 'warden'].includes(userRole);

    if (!isOwner && !isAdminOrWarden) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only cancel your own requests.'
      });
    }

    // Only allow cancellation of pending requests
    if (outpassData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending outpass requests can be cancelled'
      });
    }

    // Instead of using the RPC function, directly delete the request
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .delete()
      .eq('id', outpassId)
      .eq('user_id', userRow.id)
      .select();

    if (error) {
      console.error('Error deleting outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete outpass request',
        error: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found or already deleted'
      });
    }

    res.json({
      success: true,
      message: 'Outpass request deleted successfully'
    });

  } catch (error) {
    console.error('Exception deleting outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete outpass request',
      error: error.message
    });
  }
}));

/**
 * PUT /api/outpass/:id/status
 * Update outpass request status (approve/reject) - admin/warden only
 */
router.put('/:id/status', authMiddleware, authorize(['admin', 'warden']), asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const { status, rejection_reason, approved_by } = req.body;

  // Validate status
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Must be "approved" or "rejected".'
    });
  }

  try {
    // Check if outpass request exists
    const { data: outpassData, error: fetchError } = await supabaseAdmin
      .from('outpass_requests')
      .select('id, status, user_id')
      .eq('id', outpassId)
      .single();

    if (fetchError) {
      console.error('Error fetching outpass request:', fetchError);
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    // Check if already processed
    if (outpassData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Outpass request has already been processed'
      });
    }

    // Update the outpass request
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'approved') {
      updateData.approved_by = approved_by;
      updateData.approved_at = new Date().toISOString();
    } else if (status === 'rejected') {
      updateData.rejection_reason = rejection_reason || 'No reason provided';
    }

    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .update(updateData)
      .eq('id', outpassId)
      .select();

    if (error) {
      console.error('Error updating outpass status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update outpass status',
        error: error.message
      });
    }

    res.json({
      success: true,
      message: `Outpass request ${status} successfully`,
      data: data[0]
    });

  } catch (error) {
    console.error('Exception updating outpass status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update outpass status',
      error: error.message
    });
  }
}));

/**
 * GET /api/outpass/:id
 * Get a specific outpass request by ID
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const outpassId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .select(`
        *,
        users!outpass_requests_user_id_fkey(full_name, email),
        rooms!outpass_requests_room_id_fkey(room_number, building_id),
        buildings!rooms_building_id_fkey(building_name)
      `)
      .eq('id', outpassId)
      .single();

    if (error) {
      console.error('Error fetching outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch outpass request',
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    // Check permissions
    const isOwner = data.user_id === userId;
    const isAdminOrWarden = ['admin', 'warden'].includes(userRole);

    if (!isOwner && !isAdminOrWarden) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own outpass requests.'
      });
    }

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Exception fetching outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch outpass request',
      error: error.message
    });
  }
}));

/**
 * DELETE /api/outpass/:id
 * Delete an outpass request (only admins can delete)
 */
router.delete('/:id', authMiddleware, authorize(['admin']), asyncHandler(async (req, res) => {
  const outpassId = req.params.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('outpass_requests')
      .delete()
      .eq('id', outpassId)
      .select();

    if (error) {
      console.error('Error deleting outpass request:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete outpass request',
        error: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Outpass request not found'
      });
    }

    res.json({
      success: true,
      message: 'Outpass request deleted successfully'
    });

  } catch (error) {
    console.error('Exception deleting outpass request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete outpass request',
      error: error.message
    });
  }
}));

module.exports = router;
