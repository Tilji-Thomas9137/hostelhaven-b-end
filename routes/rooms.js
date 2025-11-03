const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/rooms
 * @desc    Get all rooms with optional filtering
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 ROOMS: Fetching rooms with query params:', req.query);
    
    const { room_type, status, floor, room_number } = req.query;
    
    let query = supabase
      .from('rooms')
      .select('*')
      .order('floor')
      .order('room_number');

    if (room_type) {
      query = query.eq('room_type', room_type);
      console.log('🔍 ROOMS: Filtering by room_type:', room_type);
    }
    
    if (status) {
      query = query.eq('status', status);
      console.log('🔍 ROOMS: Filtering by status:', status);
    }
    
    if (floor) {
      query = query.eq('floor', parseInt(floor));
      console.log('🔍 ROOMS: Filtering by floor:', floor);
    }
    
    if (room_number) {
      query = query.ilike('room_number', `%${room_number}%`);
      console.log('🔍 ROOMS: Filtering by room_number:', room_number);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error('❌ ROOMS: Query error:', error);
      throw new ValidationError('Failed to fetch rooms');
    }

    console.log('✅ ROOMS: Found', rooms?.length || 0, 'rooms');
    console.log('🔍 ROOMS: Sample rooms:', rooms?.slice(0, 2));

    // Add availability info
    const roomsWithAvailability = rooms.map(room => {
      const occupied = room.current_occupancy || 0;
      return {
        ...room,
        available_spots: room.capacity - occupied,
        is_available: occupied < room.capacity && (room.status === 'available' || room.status === 'partially_filled')
      };
    });

    res.json({
      success: true,
      data: { rooms: roomsWithAvailability }
    });
  } catch (error) {
    console.error('❌ ROOMS: Error:', error);
    throw error;
  }
}));

/**
 * @route   GET /api/rooms/test
 * @desc    Test endpoint to check rooms table
 * @access  Public
 */
router.get('/test', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 ROOMS TEST: Testing rooms table...');
    
    // Get all rooms without any filters
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ ROOMS TEST: Query error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    console.log('✅ ROOMS TEST: Found', rooms?.length || 0, 'rooms');

    res.json({
      success: true,
      count: rooms?.length || 0,
      rooms: rooms || [],
      message: `Found ${rooms?.length || 0} rooms in database`
    });
  } catch (error) {
    console.error('❌ ROOMS TEST: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}));

/**
 * @route   GET /api/rooms/my-room
 * @desc    Get current user's room details using room_allocations table
 * @access  Private
 */
router.get('/my-room', authMiddleware, asyncHandler(async (req, res) => {
  console.log('🏠 Fetching room for user:', req.user.id);
  
  try {
    // Step 1: Get user profile from user_profiles table
    console.log('🔍 Step 1: Fetching user profile...');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id, user_id, admission_number, room_id,
        users!inner(auth_uid, room_id)
      `)
      .eq('users.auth_uid', req.user.id)
      .single();

    if (profileError) {
      console.error('❌ User profile fetch error:', profileError);
      
      // If user profile doesn't exist, return no room assigned
      if (profileError.code === 'PGRST116') {
        return res.json({
          success: true,
          data: {
            room: null,
            message: 'User profile not found. Please complete your profile setup.'
          }
        });
      }
      throw new ValidationError('Failed to fetch user profile');
    }

    console.log('✅ User profile found:', { 
      profileId: profileData.id, 
      userId: profileData.user_id,
      admissionNumber: profileData.admission_number 
    });

    // Step 2: Get active room allocation
    console.log('🔍 Step 2: Fetching active room allocation...');
    let allocationData = null;
    let allocationError = null;
    
    // First, try to find confirmed/active allocations
    const { data: activeAllocation, error: activeError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        room_id,
        allocation_status,
        status,
        allocation_date,
        start_date,
        end_date,
        created_at
      `)
      .eq('student_profile_id', profileData.id)
      .in('allocation_status', ['confirmed', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAllocation) {
      allocationData = activeAllocation;
      console.log('✅ Found confirmed/active allocation');
    } else if (activeError) {
      console.error('❌ Error fetching active allocation:', activeError);
    } else {
      // If no confirmed/active allocation, check for ANY allocation (for debugging)
      console.log('⚠️ No confirmed/active allocation found, checking all allocations...');
      const { data: anyAllocation, error: anyError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          allocation_status,
          status,
          allocation_date,
          start_date,
          end_date,
          created_at
        `)
        .eq('student_profile_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyAllocation) {
        console.log('⚠️ Found allocation with status:', anyAllocation.allocation_status);
        // If allocation exists but status is different, still use it
        if (anyAllocation.room_id) {
          allocationData = anyAllocation;
          console.log('✅ Using allocation with status:', allocationData.allocation_status);
        }
      } else if (anyError) {
        console.error('❌ Error fetching any allocation:', anyError);
      }

      // Fallback: Check users.room_id or user_profiles.room_id
      if (!allocationData) {
        console.log('🔍 Checking users.room_id and user_profiles.room_id as fallback...');
        
        // Check users.room_id (from the joined query)
        const userRoomId = profileData.users?.room_id;
        if (userRoomId) {
          console.log('✅ Found room_id in users table:', userRoomId);
          allocationData = {
            id: null,
            room_id: userRoomId,
            allocation_status: 'confirmed',
            allocation_date: null,
            start_date: null,
            end_date: null,
            created_at: null
          };
        }
        
        // Also check user_profiles.room_id
        if (!allocationData && profileData.room_id) {
          console.log('✅ Found room_id in user_profiles:', profileData.room_id);
          allocationData = {
            id: null,
            room_id: profileData.room_id,
            allocation_status: 'confirmed',
            allocation_date: null,
            start_date: null,
            end_date: null,
            created_at: null
          };
        }
      }
    }

    if (!allocationData) {
      console.log('ℹ️ No room allocation found for student');
      return res.json({
        success: true,
        data: {
          room: null,
          message: 'No room allocation found. Please contact administration for room assignment.'
        }
      });
    }

    console.log('✅ Room allocation found:', { 
      allocationId: allocationData.id, 
      roomId: allocationData.room_id,
      status: allocationData.allocation_status 
    });

    // Step 3: Fetch room details
    console.log('🔍 Step 3: Fetching room details...');
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select(`
        id,
        room_number,
        floor,
        room_type,
        capacity,
        occupied,
        current_occupancy,
        price,
        status,
        created_at
      `)
      .eq('id', allocationData.room_id)
      .single();

    if (roomError) {
      console.error('❌ Room fetch error:', roomError);
      return res.json({
        success: true,
        data: {
          room: null,
          message: 'Room not found in database'
        }
      });
    }

    if (!room) {
      return res.json({
        success: true,
        data: {
          room: null,
          message: 'Room data not available'
        }
      });
    }

    console.log('✅ Room found:', { 
      roomNumber: room.room_number, 
      floor: room.floor, 
      type: room.room_type,
      capacity: room.capacity,
      occupied: room.occupied || room.current_occupancy || 0
    });

    // Step 4: Get roommates (other students in the same room)
    console.log('🔍 Step 4: Fetching roommates...');
    const { data: roommates, error: roommatesError } = await supabase
      .from('room_allocations')
      .select(`
        user_profiles!inner (
          id,
          user_id,
          admission_number,
          users!inner (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        )
      `)
      .eq('room_id', allocationData.room_id)
      .in('allocation_status', ['confirmed', 'active'])
      .neq('student_profile_id', profileData.id);

    if (roommatesError) {
      console.error('⚠️ Failed to fetch roommates:', roommatesError);
    }

    // Extract roommate data
    const roommatesList = roommates?.map(allocation => ({
      id: allocation.user_profiles.users.id,
      full_name: allocation.user_profiles.users.full_name,
      email: allocation.user_profiles.users.email,
      phone: allocation.user_profiles.users.phone,
      avatar_url: allocation.user_profiles.users.avatar_url,
      admission_number: allocation.user_profiles.admission_number
    })).filter(Boolean) || [];

    console.log('✅ Roommates found:', roommatesList.length);

    // Return successful response
    const response = {
      success: true,
      data: {
        room: {
          id: room.id,
          room_number: room.room_number,
          floor: room.floor,
          room_type: room.room_type,
          capacity: room.capacity,
          occupied: room.occupied || room.current_occupancy || 0,
          price: room.price,
          status: room.status
        },
        roommates: roommatesList,
        allocation: {
          id: allocationData.id,
          allocationStatus: allocationData.allocation_status,
          allocationDate: allocationData.allocation_date,
          startDate: allocationData.start_date,
          endDate: allocationData.end_date,
          createdAt: allocationData.created_at
        }
      }
    };

    console.log('🎉 Successfully returning room data:', {
      roomNumber: room.room_number,
      floor: room.floor,
      roomType: room.room_type,
      roommatesCount: roommatesList.length,
      allocationStatus: allocationData.allocation_status
    });

    return res.json(response);

  } catch (error) {
    console.error('❌ Error in /api/rooms/my-room:', error);
    throw error;
  }
}));

/**
 * @route   GET /api/rooms/available
 * @desc    Get available rooms with capacity awareness (single hostel system)
 * @access  Private
 */
router.get('/available', authMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('Fetching available rooms...');
    
    // First, let's get all rooms to debug
    const { data: allRooms, error: allRoomsError } = await supabase
      .from('rooms')
      .select('*')
      .order('floor')
      .order('room_number');

    if (allRoomsError) {
      console.error('Supabase error fetching all rooms:', allRoomsError);
      throw new ValidationError('Failed to fetch rooms');
    }

    console.log(`Total rooms in database: ${allRooms?.length || 0}`);
    if (allRooms && allRooms.length > 0) {
      console.log('All rooms:', allRooms.map(r => `${r.room_number} (${r.room_type}, status: ${r.status}, occupancy: ${r.current_occupancy}/${r.capacity})`));
    }

    // Now filter for available rooms
    const availableRooms = (allRooms || []).filter(room => {
      // Use the higher of current_occupancy or occupied to determine actual occupancy
      const actualOccupancy = Math.max(room.current_occupancy || 0, room.occupied || 0);
      const isAvailable = room.status !== 'full' && 
                         room.status !== 'maintenance' && 
                         actualOccupancy < (room.capacity || 0);
      console.log(`Room ${room.room_number}: status=${room.status}, current_occupancy=${room.current_occupancy}, occupied=${room.occupied}, actual=${actualOccupancy}, capacity=${room.capacity}, available=${isAvailable}`);
      return isAvailable;
    });

    console.log(`Found ${availableRooms?.length || 0} available rooms`);

    res.json({
      success: true,
      data: { rooms: availableRooms || [] }
    });
  } catch (error) {
    console.error('Error in /available endpoint:', error);
    throw error;
  }
}));

/**
 * @route   POST /api/rooms/request-change
 * @desc    Request room change
 * @access  Private
 */
router.post('/request-change', authMiddleware, [
  body('new_room_id').isUUID().withMessage('Valid room ID is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { new_room_id, reason } = req.body;

  // Get user's current room and hostel
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('room_id')
    .eq('auth_uid', req.user.id)
    .single();

  if (userError) {
    throw new ValidationError('Failed to fetch user information');
  }

  if (!user.room_id) {
    throw new ValidationError('You are not currently assigned to any room');
  }

  if (user.room_id === new_room_id) {
    throw new ValidationError('You are already in this room');
  }

  // Check if the new room is available and in the same hostel
  const { data: newRoom, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', new_room_id)
    .single();

  if (roomError || !newRoom) {
    throw new ValidationError('Room not found or not in your hostel');
  }

  if (newRoom.status !== 'available' || newRoom.occupied >= newRoom.capacity) {
    throw new ValidationError('Room is not available');
  }

  // Create room change request (using complaints table for now)
  const { data: request, error: requestError } = await supabase
    .from('complaints')
    .insert({
      user_id: req.user.id,
      room_id: user.room_id,
      title: `Room Change Request - From Room ${user.room_id} to Room ${new_room_id}`,
      description: `Reason: ${reason}\nRequested Room: ${newRoom.room_number} (Floor ${newRoom.floor})`,
      category: 'general',
      priority: 'medium',
      status: 'pending'
    })
    .select()
    .single();

  if (requestError) {
    throw new ValidationError('Failed to submit room change request');
  }

  // Notify hostel staff
  const { data: staff } = await supabase
    .from('users')
    .select('id')
    .in('role', ['warden', 'hostel_operations_assistant']);

  if (staff && staff.length > 0) {
    const notifications = staff.map(staffMember => ({
      user_id: staffMember.id,
      title: 'Room Change Request',
      message: `A student has requested to change rooms`,
      type: 'general'
    }));

    await supabase
      .from('notifications')
      .insert(notifications);
  }

  res.status(201).json({
    success: true,
    message: 'Room change request submitted successfully',
    data: { request }
  });
}));

/**
 * @route   POST /api/rooms/request
 * @desc    Request room allocation
 * @access  Private (Student)
 */
router.post('/request', authMiddleware, [
  body('room_id')
    .isUUID()
    .withMessage('Valid room ID is required'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { room_id, notes } = req.body;

  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id, user_id,
        users!inner(auth_uid)
      `)
      .eq('users.auth_uid', req.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Check if user already has an active allocation
    const { data: existingAllocation } = await supabase
      .from('room_allocations')
      .select('id, allocation_status')
      .eq('student_profile_id', userProfile.id)
      .in('allocation_status', ['pending', 'confirmed', 'active'])
      .single();

    if (existingAllocation) {
      throw new ValidationError('You already have an active room allocation');
    }

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

    if (room.status === 'full' || room.status === 'maintenance') {
      throw new ValidationError('Room is not available for allocation');
    }

    // Create room request
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .insert({
        student_profile_id: userProfile.id,
        room_id: room_id,
        request_type: 'allocation',
        notes: notes
      })
      .select()
      .single();

    if (requestError) {
      throw new ValidationError('Failed to create room request');
    }

    res.status(201).json({
      success: true,
      message: 'Room request submitted successfully',
      data: { request }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/rooms/approve
 * @desc    Approve room allocation (staff only)
 * @access  Private (Staff)
 */
router.post('/approve', authMiddleware, [
  body('request_id')
    .isUUID()
    .withMessage('Valid request ID is required'),
  body('action')
    .isIn(['approve', 'reject'])
    .withMessage('Action must be approve or reject'),
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { request_id, action, notes } = req.body;

  // Check if user is staff
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('auth_uid', req.user.id)
    .single();

  if (!user || !['admin', 'hostel_operations_assistant', 'warden'].includes(user.role)) {
    throw new AuthenticationError('Unauthorized - Staff access required');
  }

  try {
    // Get room request with details
    const { data: request, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        *,
        user_profiles!inner(user_id, admission_number),
        rooms!inner(*)
      `)
      .eq('id', request_id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      throw new ValidationError('Pending room request not found');
    }

    if (action === 'reject') {
      // Reject request
      const { error: rejectError } = await supabase
        .from('room_requests')
        .update({
          status: 'rejected',
          notes: notes || 'Request rejected by staff'
        })
        .eq('id', request_id);

      if (rejectError) {
        throw new ValidationError('Failed to reject request');
      }

      return res.json({
        success: true,
        message: 'Room request rejected successfully'
      });
    }

    // Approve request - use transaction-like approach
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', request.room_id)
      .single();

    if (roomError || !room) {
      throw new ValidationError('Room not found');
    }

    // Check capacity again (race condition protection)
    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is now at full capacity');
    }

    // Create room allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .insert({
        student_profile_id: request.student_profile_id,
        room_id: request.room_id,
        allocation_status: 'confirmed',
        notes: notes || 'Approved by staff',
        created_by: req.user.id
      })
      .select()
      .single();

    if (allocationError) {
      throw new ValidationError('Failed to create room allocation');
    }

    // Update room request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'approved',
        notes: notes || 'Approved by staff'
      })
      .eq('id', request_id);

    if (updateError) {
      throw new ValidationError('Failed to update request status');
    }

    // Update user's room assignment - CRITICAL for frontend room_id fetching
    console.log('🏠 Updating user room assignment:', {
      userId: request.user_profiles.user_id,
      roomId: request.room_id,
      studentName: request.user_profiles.admission_number
    });

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        room_id: request.room_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.user_profiles.user_id);

    if (userUpdateError) {
      console.error('❌ CRITICAL: Failed to update user room assignment:', userUpdateError);
      console.error('❌ This will cause room_id to not be fetched in frontend!');
      
      // Try to rollback the room allocation if user update fails
      const { error: rollbackError } = await supabase
        .from('room_allocations')
        .delete()
        .eq('id', allocation.id);
      
      if (rollbackError) {
        console.error('❌ Failed to rollback room allocation:', rollbackError);
      }
      
      throw new ValidationError('Failed to update user room assignment. Room allocation rolled back.');
    } else {
      console.log('✅ Successfully updated user room assignment');
    }

    // Create a pending payment and notify the student immediately
    console.log('💰 Creating payment and sending notifications for approved room request');
    
    try {
      // Calculate payment amount based on room pricing
      const amount = typeof room.price === 'number' && room.price > 0
        ? room.price
        : (room.room_type === 'single' ? 28000 : room.room_type === 'double' ? 23000 : 20000);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const due_date_iso = dueDate.toISOString().split('T')[0];

      console.log('💰 Payment details:', {
        userId: request.user_profiles.user_id,
        amount,
        dueDate: due_date_iso,
        roomNumber: room.room_number
      });

      // Insert payment (prefer admin client when available)
      const paymentInsertClient = supabaseAdmin || supabase;
      const { data: payment, error: paymentError } = await paymentInsertClient
        .from('payments')
        .insert({
          user_id: request.user_profiles.user_id,
          amount: amount,
          payment_type: 'room_rent',
          due_date: due_date_iso,
          status: 'pending',
          notes: `Room ${room.room_number} (Floor ${room.floor}) allocation approved`,
          created_by: req.user.id
        })
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Failed to create payment on allocation approval:', paymentError);
        console.error('❌ Payment error details:', JSON.stringify(paymentError, null, 2));
      } else {
        console.log('✅ Payment created successfully:', payment?.id);
      }

      // Send notifications to student and linked parent(s)
      // ALWAYS send notifications even if payment creation failed
      const notifications = [
        {
          user_id: request.user_profiles.user_id,
          title: 'Room Allocation Approved',
          message: `Your room ${room.room_number} has been approved. Payment due ₹${amount.toLocaleString()} by ${due_date_iso}.`,
          type: 'payment_due',
          metadata: {
            payment_id: payment?.id || null,
            room_id: room.id,
            room_number: room.room_number,
            amount: amount
          }
        }
      ];

      // Try to notify verified parent linked to this admission number
      try {
        const { data: parentLinks } = await supabase
          .from('parents')
          .select('user_id, verified, user_profiles!inner(admission_number)')
          .eq('verified', true)
          .eq('user_profiles.admission_number', request.user_profiles.admission_number);

        console.log('👨‍👩‍👧 Found parent links:', parentLinks?.length || 0);

        if (Array.isArray(parentLinks) && parentLinks.length > 0) {
          parentLinks.forEach((p) => {
            if (p?.user_id) {
              notifications.push({
                user_id: p.user_id,
                title: 'Payment Due for Your Child',
                message: `₹${amount.toLocaleString()} due for room ${room.room_number} by ${due_date_iso}.`,
                type: 'payment_due',
                metadata: {
                  payment_id: payment?.id || null,
                  room_id: room.id,
                  room_number: room.room_number,
                  amount: amount,
                  student_admission_number: request.user_profiles.admission_number
                }
              });
            }
          });
        }
      } catch (parentNotifyErr) {
        console.warn('⚠️ Could not resolve parent links for payment notification:', parentNotifyErr);
      }

      console.log('📬 Sending', notifications.length, 'notification(s)');
      const { data: insertedNotifications, error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (notifError) {
        console.error('❌ Failed to send payment notification:', notifError);
        console.error('❌ Notification error details:', JSON.stringify(notifError, null, 2));
      } else {
        console.log('✅ Notifications sent successfully:', insertedNotifications?.length || 0);
      }
    } catch (notifyErr) {
      console.error('⚠️ Post-approval side-effects failed:', notifyErr);
      console.error('⚠️ Error stack:', notifyErr.stack);
    }

    res.json({
      success: true,
      message: 'Room allocation approved successfully',
      data: { allocation }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/rooms/history
 * @desc    Get user's room assignment history
 * @access  Private
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const { data: assignments, error } = await supabase
    .from('room_allocations')
    .select(`
      *,
      rooms(room_number, floor, room_type, capacity)
    `)
    .eq('student_profile_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch room history');
  }

  res.json({
    success: true,
    data: { assignments }
  });
}));

/**
 * @route   GET /api/rooms/pending-requests
 * @desc    Get pending room requests (staff only)
 * @access  Private (Staff)
 */
router.get('/pending-requests', authMiddleware, asyncHandler(async (req, res) => {
  // Check if user is staff
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('auth_uid', req.user.id)
    .single();

  if (!user || !['admin', 'hostel_operations_assistant', 'warden'].includes(user.role)) {
    throw new AuthenticationError('Unauthorized - Staff access required');
  }

  const { data: requests, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      user_profiles!inner(
        admission_number,
        user_id,
        users!inner(full_name, email)
      ),
      rooms(room_number, floor, room_type, capacity, current_occupancy)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new ValidationError('Failed to fetch pending requests');
  }

  res.json({
    success: true,
    data: { requests }
  });
}));

/**
 * @route   GET /api/rooms/requests
 * @desc    Get user's room requests
 * @access  Private (Student)
 */
router.get('/requests', authMiddleware, asyncHandler(async (req, res) => {
  // Get user profile
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select(`
      id,
      users!inner(auth_uid)
    `)
    .eq('users.auth_uid', req.user.id)
    .single();

  if (profileError || !userProfile) {
    throw new ValidationError('User profile not found');
  }

  const { data: requests, error } = await supabase
    .from('room_requests')
    .select(`
      *,
      rooms(room_number, floor, room_type, capacity)
    `)
    .eq('student_profile_id', userProfile.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ValidationError('Failed to fetch room requests');
  }

  res.json({
    success: true,
    data: { requests }
  });
}));

/**
 * @route   GET /api/rooms/debug-data
 * @desc    Debug room allocation data (no auth required for testing)
 * @access  Public (for debugging)
 */
router.get('/debug-data', asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Debug: Fetching room allocation data...');
    
    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, user_id, admission_number')
      .limit(10);

    // Get all room allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        student_profile_id,
        room_id,
        allocation_status,
        status,
        created_at
      `)
      .limit(10);

    // Get all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, room_number, floor, room_type, capacity, occupied, status')
      .limit(10);

    res.json({
      success: true,
      debug: {
        profiles: {
          count: profiles?.length || 0,
          data: profiles || [],
          error: profilesError
        },
        allocations: {
          count: allocations?.length || 0,
          data: allocations || [],
          error: allocationsError
        },
        rooms: {
          count: rooms?.length || 0,
          data: rooms || [],
          error: roomsError
        }
      }
    });

  } catch (error) {
    console.error('Debug data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch debug data',
      error: error.message
    });
  }
}));

/**
 * @route   GET /api/rooms/debug-user/:userId
 * @desc    Debug user room assignment data
 * @access  Private (Admin)
 */
router.get('/debug-user/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Check if user exists in our database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, room_id, full_name, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.json({
        success: false,
        message: 'User not found',
        error: userError
      });
    }

    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    // Get room allocations
    const { data: allocations, error: allocationError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        room_id,
        allocation_status,
        status,
        allocation_date,
        start_date,
        end_date,
        rooms(room_number, floor, room_type, capacity, occupied, price, status)
      `)
      .eq('student_profile_id', profileData?.id || 'none')
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      data: {
        user,
        userProfile: profileData,
        roomAllocations: allocations || [],
        summary: {
          hasRoomId: !!user.room_id,
          hasProfile: !!profileData,
          allocationCount: allocations?.length || 0,
          activeAllocations: allocations?.filter(a => ['confirmed', 'active'].includes(a.allocation_status)).length || 0
        }
      }
    });

  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug user',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/rooms/fix-allocations
 * @desc    Fix room allocations with null student_profile_id (Admin only)
 * @access  Private (Admin)
 */
router.post('/fix-allocations', authMiddleware, asyncHandler(async (req, res) => {
  // Check if user is admin
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (userError || user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized - Admin access required'
    });
  }

  try {
    console.log('🔧 Fixing room allocations with null student_profile_id...');
    
    // Get allocations with null student_profile_id
    const { data: brokenAllocations, error: fetchError } = await supabase
      .from('room_allocations')
      .select('*')
      .is('student_profile_id', null);

    if (fetchError) {
      throw new Error('Failed to fetch broken allocations');
    }

    if (!brokenAllocations || brokenAllocations.length === 0) {
      return res.json({
        success: true,
        message: 'No broken allocations found',
        data: { fixedCount: 0 }
      });
    }

    let fixedCount = 0;

    // Fix each allocation by assigning it to the first available student profile
    for (const allocation of brokenAllocations) {
      // Get a student profile that doesn't have an allocation
      const { data: availableProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .not('id', 'in', `(SELECT student_profile_id FROM room_allocations WHERE student_profile_id IS NOT NULL)`)
        .limit(1)
        .single();

      if (availableProfile && !profileError) {
        // Update the allocation with the student profile ID
        const { error: updateError } = await supabase
          .from('room_allocations')
          .update({ student_profile_id: availableProfile.id })
          .eq('id', allocation.id);

        if (!updateError) {
          fixedCount++;
          console.log(`✅ Fixed allocation ${allocation.id} -> profile ${availableProfile.id}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixedCount} room allocations`,
      data: { fixedCount }
    });

  } catch (error) {
    console.error('Fix allocations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix allocations',
      error: error.message
    });
  }
}));

/**
 * @route   POST /api/rooms/sync-room-ids
 * @desc    Sync room_id in users table with room_allocations (Admin only)
 * @access  Private (Admin)
 */
router.post('/sync-room-ids', authMiddleware, asyncHandler(async (req, res) => {
  // Check if user is admin
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (userError || user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized - Admin access required'
    });
  }

  try {
    console.log('🔧 Starting room_id synchronization...');
    
    // Get all active room allocations that need syncing
    const { data: allocations, error: allocationsError } = await supabase
      .from('room_allocations')
      .select(`
        room_id,
        student_profile_id,
        allocation_status,
        user_profiles!inner(user_id)
      `)
      .in('allocation_status', ['confirmed', 'active'])
      .not('room_id', 'is', null);

    if (allocationsError) {
      throw new Error('Failed to fetch room allocations');
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Update each user's room_id
    for (const allocation of allocations) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            room_id: allocation.room_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', allocation.user_profiles.user_id)
          .neq('room_id', allocation.room_id); // Only update if different

        if (updateError) {
          console.error('Failed to update user:', allocation.user_profiles.user_id, updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error('Error updating user:', error);
        errorCount++;
      }
    }

    console.log(`✅ Sync completed. Updated ${updatedCount} users, ${errorCount} errors.`);

    res.json({
      success: true,
      message: 'Room ID synchronization completed',
      data: {
        updatedCount,
        errorCount,
        totalProcessed: allocations.length
      }
    });

  } catch (error) {
    console.error('Room ID sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync room IDs',
      error: error.message
    });
  }
}));

module.exports = router;