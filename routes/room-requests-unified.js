/**
 * @route   POST /api/room-requests/create
 * @desc    Create a new room request (unified endpoint)
 * @access  Private (Student)
 */
router.post('/create', authMiddleware, [
  body('preferred_room_type').isIn(['single', 'double', 'triple']).withMessage('Invalid room type'),
  body('preferred_floor').optional().isInt({ min: 1, max: 8 }).withMessage('Floor must be between 1 and 8'),
  body('special_requirements').optional().isString().withMessage('Special requirements must be text'),
  body('urgency_level').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid urgency level'),
  body('requested_room_id').optional().isUUID().withMessage('Invalid room ID')
], asyncHandler(async (req, res) => {
  console.log('🚀 ROOM REQUEST CREATION: Starting...');
  console.log('🚀 ROOM REQUEST CREATION: User ID:', req.user.id);
  console.log('🚀 ROOM REQUEST CREATION: Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ ROOM REQUEST CREATION: Validation failed:', errors.array());
    throw new ValidationError('Validation failed', errors.array());
  }

  const { preferred_room_type, preferred_floor, special_requirements, urgency_level, requested_room_id } = req.body;

  try {
    // Get user information
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, role, room_id')
      .eq('auth_uid', req.user.id)
      .single();

    if (userError || !userRow) {
      console.error('❌ ROOM REQUEST CREATION: User not found:', userError);
      throw new ValidationError('User not found');
    }

    console.log('✅ ROOM REQUEST CREATION: User found:', userRow.id);

    // Check if user already has an active request
    const { data: existingRequest, error: checkError } = await supabase
      .from('room_requests')
      .select('id, status, created_at')
      .eq('user_id', userRow.id)
      .in('status', ['pending', 'waitlisted', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      console.log('❌ ROOM REQUEST CREATION: User already has active request:', existingRequest);
      throw new ValidationError(`You already have an active room request (${existingRequest.status})`);
    }

    // Check if user already has a room allocated
    if (userRow.room_id) {
      console.log('❌ ROOM REQUEST CREATION: User already has room:', userRow.room_id);
      throw new ValidationError('You already have a room allocated');
    }

    // Check if requested room exists and is available
    let roomValidation = null;
    if (requested_room_id) {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, capacity, current_occupancy, status')
        .eq('id', requested_room_id)
        .single();

      if (roomError || !roomData) {
        throw new ValidationError('Requested room not found');
      }

      if (roomData.current_occupancy >= roomData.capacity) {
        throw new ValidationError('Requested room is at full capacity');
      }

      if (!['available', 'partially_filled'].includes(roomData.status)) {
        throw new ValidationError('Requested room is not available');
      }

      roomValidation = roomData;
    }

    // Prepare insert data
    const insertData = {
      user_id: userRow.id,
      preferred_room_type,
      preferred_floor: preferred_floor || null,
      special_requirements: special_requirements || null,
      urgency_level: urgency_level || 'medium',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add room-specific information if room was requested
    if (requested_room_id) {
      insertData.requested_room_id = requested_room_id;
      insertData.special_requirements = special_requirements 
        ? `${special_requirements}\nREQUESTED_ROOM_ID:${requested_room_id}`
        : `REQUESTED_ROOM_ID:${requested_room_id}`;
    }

    console.log('📝 ROOM REQUEST CREATION: Inserting with data:', insertData);

    // Create the room request
    const { data: newRequest, error: createError } = await supabase
      .from('room_requests')
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      console.error('❌ ROOM REQUEST CREATION: Database error:', createError);
      throw new ValidationError(`Failed to create room request: ${createError.message}`);
    }

    if (!newRequest) {
      console.error('❌ ROOM REQUEST CREATION: No data returned');
      throw new ValidationError('Room request creation failed - no data returned');
    }

    console.log('✅ ROOM REQUEST CREATION: Successfully created:', newRequest.id);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Room request submitted successfully',
      data: {
        request: {
          id: newRequest.id,
          user_id: newRequest.user_id,
          preferred_room_type: newRequest.preferred_room_type,
          preferred_floor: newRequest.preferred_floor,
          special_requirements: newRequest.special_requirements,
          urgency_level: newRequest.urgency_level,
          status: newRequest.status,
          created_at: newRequest.created_at
        },
        room_info: roomValidation ? {
          room_number: roomValidation.room_number,
          capacity: roomValidation.capacity,
          current_occupancy: roomValidation.current_occupancy
        } : null
      }
    });

  } catch (error) {
    console.error('❌ ROOM REQUEST CREATION: Error:', error);
    throw error;
  }
}));
