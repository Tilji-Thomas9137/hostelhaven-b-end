/**
 * @route   PUT /api/room-requests/:id/cancel
 * @desc    Cancel a room request (student can cancel their own)
 * @access  Private
 */
router.put('/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('🔍 CANCEL: Starting cancellation for request:', id);
  console.log('🔍 CANCEL: User ID:', req.user.id);

  try {
    // Get user information
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userRow) {
      console.error('❌ CANCEL: User not found:', userError);
      throw new ValidationError('User not found');
    }

    console.log('✅ CANCEL: User found:', userRow.id, 'Role:', userRow.role);

    // Get room request
    const { data: requestData, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        id,
        user_id,
        status,
        created_at,
        processed_at
      `)
      .eq('id', id)
      .single();

    if (requestError || !requestData) {
      console.error('❌ CANCEL: Request not found:', requestError);
      
      // Check if request exists at all
      const { data: allRequests } = await supabase
        .from('room_requests')
        .select('id, status, user_id')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('🔍 CANCEL: Recent requests:', allRequests);
      
      if (requestError && requestError.code === 'PGRST116') {
        throw new ValidationError(`Room request with ID '${id}' does not exist`);
      } else {
        throw new ValidationError(`Room request not found: ${requestError?.message || 'Unknown error'}`);
      }
    }

    const request = requestData;
    console.log('✅ CANCEL: Request found:', request.id, 'Status:', request.status, 'User:', request.user_id);

    // Check ownership (students can only cancel their own, staff can cancel any)
    const isOwner = request.user_id === userRow.id;
    const isStaff = ['admin', 'staff', 'operations'].includes(userRow.role);
    
    if (!isOwner && !isStaff) {
      console.error('❌ CANCEL: Access denied - not owner and not staff');
      throw new AuthorizationError('You can only cancel your own requests');
    }

    // Check if request can be cancelled
    if (request.status === 'allocated') {
      throw new ValidationError('Cannot cancel an allocated request. Please contact support.');
    }

    if (request.status === 'cancelled') {
      throw new ValidationError('Request is already cancelled');
    }

    if (request.status === 'rejected') {
      throw new ValidationError('Cannot cancel a rejected request');
    }

    console.log('✅ CANCEL: Request can be cancelled, proceeding...');

    // Update request status to cancelled
    const { error: updateError } = await supabase
      .from('room_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userRow.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ CANCEL: Failed to update request:', updateError);
      throw new Error(`Failed to cancel request: ${updateError.message}`);
    }

    console.log('✅ CANCEL: Request status updated to cancelled');

    // If request was approved, we need to handle room allocation cleanup
    if (request.status === 'approved') {
      console.log('🔄 CANCEL: Request was approved, cleaning up room allocation...');
      
      // Get room allocation
      const { data: allocationData } = await supabase
        .from('room_allocations')
        .select('room_id')
        .eq('user_id', request.user_id)
        .single();

      if (allocationData) {
        // Remove room allocation
        await supabase
          .from('room_allocations')
          .delete()
          .eq('user_id', request.user_id);

        console.log('✅ CANCEL: Room allocation removed');

        // Update room occupancy
        const { data: roomData } = await supabase
          .from('rooms')
          .select('current_occupancy, capacity')
          .eq('id', allocationData.room_id)
          .single();

        if (roomData) {
          const newOccupancy = Math.max(0, roomData.current_occupancy - 1);
          const newStatus = newOccupancy >= roomData.capacity ? 'full' : 
                           newOccupancy > 0 ? 'partially_filled' : 'available';

          await supabase
            .from('rooms')
            .update({
              current_occupancy: newOccupancy,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', allocationData.room_id);

          console.log('✅ CANCEL: Room occupancy updated:', newOccupancy);
        }

        // Clear student's room_id
        await supabase
          .from('user_profiles')
          .update({ 
            room_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', request.user_id);

        await supabase
          .from('users')
          .update({ 
            room_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', request.user_id);

        console.log('✅ CANCEL: Student room_id cleared');
      }
    }

    // Remove from waitlist if exists
    await supabase
      .from('room_waitlist')
      .delete()
      .eq('room_request_id', id);

    console.log('🎉 CANCEL: Request cancelled successfully');

    res.json({
      success: true,
      message: 'Room request cancelled successfully',
      data: {
        request_id: id,
        previous_status: request.status,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userRow.id
      }
    });

  } catch (error) {
    console.error('❌ CANCEL: Error:', error);
    throw error;
  }
}));

/**
 * @route   DELETE /api/room-requests/:id
 * @desc    Delete a room request completely (staff only)
 * @access  Private (Staff)
 */
router.delete('/:id', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('🔍 DELETE: Starting deletion for request:', id);

  try {
    // Get staff information
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    console.log('✅ DELETE: Staff found:', staff.full_name);

    // Get room request
    const { data: requestData, error: requestError } = await supabase
      .from('room_requests')
      .select('id, user_id, status, room_id')
      .eq('id', id)
      .single();

    if (requestError || !requestData) {
      console.error('❌ DELETE: Request not found:', requestError);
      throw new ValidationError('Room request not found');
    }

    const request = requestData;
    console.log('✅ DELETE: Request found:', request.id, 'Status:', request.status);

    // Clean up related data first
    if (request.status === 'approved') {
      // Remove room allocation
      await supabase
        .from('room_allocations')
        .delete()
        .eq('user_id', request.user_id);

      // Update room occupancy if room was allocated
      if (request.room_id) {
        const { data: roomData } = await supabase
          .from('rooms')
          .select('current_occupancy, capacity')
          .eq('id', request.room_id)
          .single();

        if (roomData) {
          const newOccupancy = Math.max(0, roomData.current_occupancy - 1);
          const newStatus = newOccupancy >= roomData.capacity ? 'full' : 
                           newOccupancy > 0 ? 'partially_filled' : 'available';

          await supabase
            .from('rooms')
            .update({
              current_occupancy: newOccupancy,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.room_id);
        }
      }

      // Clear student's room_id
      await supabase
        .from('user_profiles')
        .update({ room_id: null })
        .eq('user_id', request.user_id);

      await supabase
        .from('users')
        .update({ room_id: null })
        .eq('id', request.user_id);
    }

    // Remove from waitlist
    await supabase
      .from('room_waitlist')
      .delete()
      .eq('room_request_id', id);

    // Delete the request
    const { error: deleteError } = await supabase
      .from('room_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ DELETE: Failed to delete request:', deleteError);
      throw new Error(`Failed to delete request: ${deleteError.message}`);
    }

    console.log('🎉 DELETE: Request deleted successfully');

    res.json({
      success: true,
      message: 'Room request deleted successfully',
      data: {
        request_id: id,
        deleted_at: new Date().toISOString(),
        deleted_by: staff.id
      }
    });

  } catch (error) {
    console.error('❌ DELETE: Error:', error);
    throw error;
  }
}));
