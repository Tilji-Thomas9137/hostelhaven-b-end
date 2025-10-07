const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const crypto = require('crypto');

const router = express.Router();

// HMAC secret for token signing
const HMAC_SECRET = process.env.PARCEL_HMAC_SECRET || 'your-secret-key-change-in-production';

/**
 * Generate signed token for parcel
 */
const generateParcelToken = (parcelId, studentId, expiryTime) => {
  const payload = {
    parcelId,
    studentId,
    expiry: expiryTime.getTime()
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payloadString)
    .digest('hex');
  
  return Buffer.from(payloadString + ':' + signature).toString('base64');
};

/**
 * Verify parcel token
 */
const verifyParcelToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payloadString, signature] = decoded.split(':');
    
    if (!payloadString || !signature) {
      return null;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(payloadString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(payloadString);
    
    // Check if token is expired
    if (Date.now() > payload.expiry) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
};

/**
 * @route   POST /api/parcels/create
 * @desc    Create parcel entry (staff only)
 * @access  Private (Staff)
 */
router.post('/create', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden']),
  body('student_admission_number')
    .notEmpty()
    .withMessage('Student admission number is required'),
  body('parcel_name')
    .notEmpty()
    .withMessage('Parcel name is required'),
  body('sender_name')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Sender name too long'),
  body('sender_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid sender phone number'),
  body('expiry_hours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Expiry must be between 1 and 168 hours')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { 
    student_admission_number, 
    parcel_name, 
    sender_name, 
    sender_phone,
    expiry_hours = 24 
  } = req.body;

  try {
    // Find student profile by admission number
    const { data: studentProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        admission_number,
        users!inner(
          full_name,
          phone
        )
      `)
      .eq('admission_number', student_admission_number)
      .single();

    if (profileError || !studentProfile) {
      throw new ValidationError('Student not found with this admission number');
    }

    // Generate token
    const expiryTime = new Date(Date.now() + expiry_hours * 60 * 60 * 1000);
    const token = generateParcelToken(
      crypto.randomUUID(), 
      studentProfile.id, 
      expiryTime
    );

    // Create parcel record
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .insert({
        student_profile_id: studentProfile.id,
        parcel_name,
        sender_name,
        sender_phone,
        token,
        token_expires_at: expiryTime,
        status: 'pending'
      })
      .select()
      .single();

    if (parcelError) {
      throw new ValidationError('Failed to create parcel record');
    }

    res.status(201).json({
      success: true,
      message: 'Parcel created successfully',
      data: {
        parcel: {
          id: parcel.id,
          parcel_name: parcel.parcel_name,
          student_name: studentProfile.users.full_name,
          token: parcel.token,
          expires_at: parcel.token_expires_at
        }
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parcels/verify
 * @desc    Verify parcel token and mark as claimed (staff only)
 * @access  Private (Staff)
 */
router.post('/verify', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant']),
  body('token')
    .notEmpty()
    .withMessage('Parcel token is required'),
  body('student_phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid student phone number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { token, student_phone } = req.body;

  try {
    // Verify token
    const tokenData = verifyParcelToken(token);
    if (!tokenData) {
      throw new ValidationError('Invalid or expired parcel token');
    }

    // Find parcel record
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(
            full_name,
            phone
          )
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (parcelError || !parcel) {
      throw new ValidationError('Parcel not found or already claimed');
    }

    // Verify student identity (optional phone verification)
    if (student_phone && student_phone !== parcel.user_profiles.users.phone) {
      throw new ValidationError('Student phone number does not match');
    }

    // Mark parcel as claimed
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by: req.user.id
      })
      .eq('id', parcel.id)
      .select()
      .single();

    if (updateError) {
      throw new ValidationError('Failed to mark parcel as claimed');
    }

    // Log the claim event
    console.log(`Parcel ${parcel.id} claimed by student ${parcel.user_profiles.users.full_name} (${parcel.user_profiles.admission_number})`);

    res.json({
      success: true,
      message: 'Parcel verified and claimed successfully',
      data: {
        parcel: {
          id: updatedParcel.id,
          parcel_name: updatedParcel.parcel_name,
          student_name: parcel.user_profiles.users.full_name,
          student_admission: parcel.user_profiles.admission_number,
          claimed_at: updatedParcel.claimed_at
        }
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcels/student
 * @desc    Get student's parcels
 * @access  Private (Student)
 */
router.get('/student', [
  authMiddleware,
  authorize(['student'])
], asyncHandler(async (req, res) => {
  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Get parcels for this student
    const { data: parcels, error: parcelsError } = await supabase
      .from('parcels')
      .select('*')
      .eq('student_profile_id', userProfile.id)
      .order('created_at', { ascending: false });

    if (parcelsError) {
      throw new ValidationError('Failed to fetch parcels');
    }

    res.json({
      success: true,
      data: { parcels }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcels/pending
 * @desc    Get all pending parcels (staff only)
 * @access  Private (Staff)
 */
router.get('/pending', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden'])
], asyncHandler(async (req, res) => {
  try {
    const { data: parcels, error } = await supabase
      .from('parcels')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(
            full_name,
            phone
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new ValidationError('Failed to fetch pending parcels');
    }

    res.json({
      success: true,
      data: { parcels }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parcels/expired
 * @desc    Get expired parcels (staff only)
 * @access  Private (Staff)
 */
router.get('/expired', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant'])
], asyncHandler(async (req, res) => {
  try {
    const { data: parcels, error } = await supabase
      .from('parcels')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(
            full_name,
            phone
          )
        )
      `)
      .eq('status', 'pending')
      .lt('token_expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new ValidationError('Failed to fetch expired parcels');
    }

    res.json({
      success: true,
      data: { parcels }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parcels/cleanup-expired
 * @desc    Mark expired parcels as expired (staff only)
 * @access  Private (Staff)
 */
router.post('/cleanup-expired', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant'])
], asyncHandler(async (req, res) => {
  try {
    const { error } = await supabase
      .from('parcels')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('token_expires_at', new Date().toISOString());

    if (error) {
      throw new ValidationError('Failed to cleanup expired parcels');
    }

    res.json({
      success: true,
      message: 'Expired parcels cleaned up successfully'
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;
