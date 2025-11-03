/**
 * @route   PUT /api/room-requests/:id/approve
 * @desc    Approve room request and automatically allocate room
 * @access  Private (Staff/Admin)
 */
router.put('/:id/approve', authMiddleware, staffMiddleware, [
  body('room_id').isUUID().withMessage('Valid room ID is required'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const { room_id, notes } = req.body;

  console.log('🔍 APPROVAL: Starting approval process for request:', id, 'room:', room_id);

  try {
    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    console.log('✅ APPROVAL: Staff found:', staff.full_name);

    // Get room request
    const { data: requestData, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        preferred_room_type,
        status,
        created_at
      `)
      .eq('id', id)
      .single();

    if (requestError || !requestData) {
      console.error('❌ APPROVAL: Request not found:', requestError);
      throw new ValidationError('Room request not found');
    }

    const request = requestData;
    console.log('✅ APPROVAL: Request found:', request.id, 'Status:', request.status);

    if (request.status !== 'pending') {
      throw new ValidationError(`Cannot approve request with status: ${request.status}`);
    }

    // Check if room is available
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, capacity, current_occupancy, status')
      .eq('id', room_id)
      .single();

    if (roomError || !roomData) {
      throw new ValidationError('Room not found');
    }

    const room = roomData;
    console.log('✅ APPROVAL: Room found:', room.room_number, 'Capacity:', room.capacity, 'Current:', room.current_occupancy);

    if (room.current_occupancy >= room.capacity) {
      throw new ValidationError('Room is at full capacity');
    }

    if (!['available', 'partially_filled'].includes(room.status)) {
      throw new ValidationError('Room is not available for allocation');
    }

    // Start transaction-like operations
    console.log('🔄 APPROVAL: Starting approval and allocation process...');

    // 1. Update request status
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: staff.id,
        notes: notes || 'Request approved and room allocated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ APPROVAL: Failed to update request:', updateError);
      throw new Error(`Failed to update request: ${updateError.message}`);
    }

    console.log('✅ APPROVAL: Request status updated to approved');

    // 2. Create room allocation
    const { data: newAllocation, error: allocationError } = await supabase
      .from('room_allocations')
      .upsert({
        user_id: request.user_id,
        room_id: room_id,
        allocation_status: 'confirmed',
        allocated_at: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0],
        allocation_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (allocationError) {
      console.error('❌ APPROVAL: Room allocation error:', allocationError);
      // Rollback request update
      await supabase.from('room_requests').update({ status: 'pending' }).eq('id', id);
      throw new Error(`Failed to create room allocation: ${allocationError.message}`);
    }

    console.log('✅ APPROVAL: Room allocation created:', newAllocation.id);

    // 3. Update room occupancy
    const newOccupancy = room.current_occupancy + 1;
    const newStatus = newOccupancy >= room.capacity ? 'full' : 
                     newOccupancy > 0 ? 'partially_filled' : 'available';

    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({
        current_occupancy: newOccupancy,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', room_id);

    if (roomUpdateError) {
      console.warn(`⚠️ APPROVAL: Failed to update room occupancy: ${roomUpdateError.message}`);
    } else {
      console.log('✅ APPROVAL: Room occupancy updated:', newOccupancy, 'Status:', newStatus);
    }

    // 4. Update student's profile with room_id
    const { error: studentUpdateError } = await supabase
      .from('user_profiles')
      .update({ 
        room_id: room_id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', request.user_id);

    if (studentUpdateError) {
      console.warn(`⚠️ APPROVAL: Failed to update student profile: ${studentUpdateError.message}`);
      // Also try updating the users table as fallback
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          room_id: room_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.user_id);
      
      if (userUpdateError) {
        console.warn(`⚠️ APPROVAL: Failed to update user table: ${userUpdateError.message}`);
      } else {
        console.log('✅ APPROVAL: Updated users table with room_id');
      }
    } else {
      console.log('✅ APPROVAL: Updated user_profiles table with room_id');
    }

    // 5. Get student information for response
    const { data: studentInfo } = await supabase
      .from('users')
      .select('email, full_name, linked_admission_number')
      .eq('id', request.user_id)
      .single();

    console.log('🎉 APPROVAL: Complete! Request approved and room allocated successfully');

    // Return success response
    res.json({
      success: true,
      message: 'Room request approved and allocated successfully',
      data: {
        request_id: id,
        allocation: {
          id: newAllocation.id,
          user_id: newAllocation.user_id,
          room_id: newAllocation.room_id,
          allocation_status: newAllocation.allocation_status,
          start_date: newAllocation.start_date,
          allocated_at: newAllocation.allocated_at
        },
        room: {
          id: room.id,
          room_number: room.room_number,
          capacity: room.capacity,
          current_occupancy: newOccupancy,
          status: newStatus
        },
        student: studentInfo ? {
          email: studentInfo.email,
          full_name: studentInfo.full_name,
          admission_number: studentInfo.linked_admission_number
        } : null,
        processed_by: {
          id: staff.id,
          name: staff.full_name,
          role: staff.role
        }
      }
    });

  } catch (error) {
    console.error('❌ APPROVAL: Error:', error);
    throw error;
  }
}));
