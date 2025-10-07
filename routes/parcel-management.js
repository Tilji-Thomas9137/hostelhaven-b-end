const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Middleware to check staff access (admin, warden, assistant)
const staffMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Staff access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Staff access required');
  }
};

// Middleware to check student access
const studentMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || userProfile.role !== 'student') {
      throw new AuthorizationError('Student access required');
    }
    
    next();
  } catch (error) {
    throw new AuthorizationError('Student access required');
  }
};

// Generate QR token with HMAC and expiry
const generateQRToken = (parcelId, studentId, expiryMinutes = 60) => {
  const payload = {
    parcel_id: parcelId,
    student_id: studentId,
    timestamp: Date.now(),
    expiry: Date.now() + (expiryMinutes * 60 * 1000)
  };
  
  const payloadString = JSON.stringify(payload);
  const secret = process.env.QR_SECRET || 'default-secret-key';
  const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  
  const token = Buffer.from(payloadString + ':' + signature).toString('base64');
  return token;
};

// Verify QR token
const verifyQRToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payloadString, signature] = decoded.split(':');
    
    if (!payloadString || !signature) {
      throw new Error('Invalid token format');
    }
    
    const secret = process.env.QR_SECRET || 'default-secret-key';
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }
    
    const payload = JSON.parse(payloadString);
    
    if (Date.now() > payload.expiry) {
      throw new Error('Token expired');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * @route   POST /api/parcel-management/parcels
 * @desc    Staff logs parcel arrival and generates QR token
 * @access  Private (Staff)
 */
router.post('/parcels', authMiddleware, staffMiddleware, [
  body('student_name').notEmpty().withMessage('Student name is required'),
  body('student_admission_number').notEmpty().withMessage('Student admission number is required'),
  body('sender_name').notEmpty().withMessage('Sender name is required'),
  body('sender_contact').optional().isString().withMessage('Sender contact must be text'),
  body('description').optional().isString().withMessage('Description must be text'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be positive'),
  body('size').optional().isString().withMessage('Size must be text'),
  body('notes').optional().isString().withMessage('Notes must be text')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const {
    student_name,
    student_admission_number,
    sender_name,
    sender_contact,
    description,
    weight,
    size,
    notes
  } = req.body;

  try {
    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    // Find student by admission number
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('admission_number', student_admission_number)
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student not found with the given admission number');
    }

    // Create parcel record
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .insert({
        student_id: student.id,
        student_name,
        student_admission_number,
        sender_name,
        sender_contact,
        description,
        weight,
        size,
        notes,
        status: 'arrived',
        received_by: staff.id,
        received_at: new Date().toISOString(),
        qr_token: null, // Will be set after creation
        qr_token_expiry: null
      })
      .select()
      .single();

    if (parcelError) {
      throw new Error(`Failed to create parcel record: ${parcelError.message}`);
    }

    // Generate QR token (valid for 24 hours)
    const qrToken = generateQRToken(parcel.id, student.id, 24 * 60);
    
    // Update parcel with QR token
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      .update({
        qr_token: qrToken,
        qr_token_expiry: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString()
      })
      .eq('id', parcel.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update parcel with QR token: ${updateError.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        parcel: updatedParcel,
        qr_token: qrToken,
        message: 'Parcel logged successfully and QR token generated'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcel-management/parcels
 * @desc    Get all parcels with filtering
 * @access  Private (Staff)
 */
router.get('/parcels', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('parcels')
      .select(`
        id,
        student_id,
        student_name,
        student_admission_number,
        sender_name,
        sender_contact,
        description,
        weight,
        size,
        status,
        received_at,
        claimed_at,
        received_by,
        claimed_by,
        notes,
        qr_token_expiry,
        users!parcels_received_by_fkey(
          full_name
        )
      `)
      .order('received_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`student_name.ilike.%${search}%,student_admission_number.ilike.%${search}%,sender_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: parcels, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch parcels: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('parcels')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (search) {
      countQuery = countQuery.or(`student_name.ilike.%${search}%,student_admission_number.ilike.%${search}%,sender_name.ilike.%${search}%`);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: { 
        parcels: parcels || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcel-management/parcels/my-parcels
 * @desc    Get student's own parcels
 * @access  Private (Student)
 */
router.get('/parcels/my-parcels', authMiddleware, studentMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('user_profiles')
      .select('id, admission_number')
      .eq('auth_uid', req.user.id)
      .single();

    if (studentError || !student) {
      throw new ValidationError('Student profile not found');
    }

    // Get student's parcels
    const { data: parcels, error } = await supabase
      .from('parcels')
      .select(`
        id,
        student_name,
        sender_name,
        sender_contact,
        description,
        weight,
        size,
        status,
        received_at,
        claimed_at,
        notes
      `)
      .eq('student_id', student.id)
      .order('received_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch parcels: ${error.message}`);
    }

    res.json({
      success: true,
      data: { parcels: parcels || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parcel-management/verify-qr
 * @desc    Staff verifies QR token and marks parcel as claimed
 * @access  Private (Staff)
 */
router.post('/verify-qr', authMiddleware, staffMiddleware, [
  body('qr_token').notEmpty().withMessage('QR token is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { qr_token } = req.body;

  try {
    // Verify QR token
    let tokenPayload;
    try {
      tokenPayload = verifyQRToken(qr_token);
    } catch (error) {
      throw new ValidationError(error.message);
    }

    // Get staff user profile
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('auth_uid', req.user.id)
      .single();

    if (staffError || !staff) {
      throw new ValidationError('Staff profile not found');
    }

    // Get parcel details
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('*')
      .eq('id', tokenPayload.parcel_id)
      .single();

    if (parcelError || !parcel) {
      throw new ValidationError('Parcel not found');
    }

    // Check if parcel is already claimed
    if (parcel.status === 'claimed') {
      throw new ValidationError('Parcel has already been claimed');
    }

    // Verify student ID matches
    if (parcel.student_id !== tokenPayload.student_id) {
      throw new ValidationError('QR token does not match this parcel');
    }

    // Mark parcel as claimed
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by: staff.id,
        qr_token: null, // Invalidate token after use
        qr_token_expiry: null
      })
      .eq('id', parcel.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update parcel status: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        parcel: updatedParcel,
        message: 'Parcel claimed successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcel-management/parcels/:id/qr-code
 * @desc    Generate QR code data for parcel
 * @access  Private (Staff)
 */
router.get('/parcels/:id/qr-code', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Get parcel details
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('*')
      .eq('id', id)
      .single();

    if (parcelError || !parcel) {
      throw new ValidationError('Parcel not found');
    }

    if (parcel.status === 'claimed') {
      throw new ValidationError('Parcel has already been claimed');
    }

    // Check if QR token is still valid
    if (!parcel.qr_token || (parcel.qr_token_expiry && new Date() > new Date(parcel.qr_token_expiry))) {
      throw new ValidationError('QR token has expired. Please regenerate.');
    }

    res.json({
      success: true,
      data: {
        qr_token: parcel.qr_token,
        student_name: parcel.student_name,
        sender_name: parcel.sender_name,
        received_at: parcel.received_at,
        expiry: parcel.qr_token_expiry
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parcel-management/parcels/:id/regenerate-qr
 * @desc    Regenerate QR token for parcel
 * @access  Private (Staff)
 */
router.post('/parcels/:id/regenerate-qr', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Get parcel details
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('*')
      .eq('id', id)
      .single();

    if (parcelError || !parcel) {
      throw new ValidationError('Parcel not found');
    }

    if (parcel.status === 'claimed') {
      throw new ValidationError('Cannot regenerate QR for claimed parcel');
    }

    // Generate new QR token
    const qrToken = generateQRToken(parcel.id, parcel.student_id, 24 * 60);

    // Update parcel with new QR token
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      .update({
        qr_token: qrToken,
        qr_token_expiry: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to regenerate QR token: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        qr_token: qrToken,
        message: 'QR token regenerated successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcel-management/stats
 * @desc    Get parcel statistics for dashboard
 * @access  Private (Staff)
 */
router.get('/stats', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get parcel counts by status
    const { count: totalParcels } = await supabase
      .from('parcels')
      .select('*', { count: 'exact', head: true });

    const { count: arrivedParcels } = await supabase
      .from('parcels')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'arrived');

    const { count: claimedParcels } = await supabase
      .from('parcels')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'claimed');

    // Get today's parcels
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: todayParcels } = await supabase
      .from('parcels')
      .select('*', { count: 'exact', head: true })
      .gte('received_at', today.toISOString())
      .lt('received_at', tomorrow.toISOString());

    res.json({
      success: true,
      data: {
        total_parcels: totalParcels || 0,
        arrived_parcels: arrivedParcels || 0,
        claimed_parcels: claimedParcels || 0,
        today_parcels: todayParcels || 0
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
