const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { sendActivationEmail } = require('../utils/resend-mailer');

const router = express.Router();

/**
 * @route   POST /api/hostel_assistant/create-student
 * @desc    Create a new student account (hostel operations assistant only)
 * @access  Private (Hostel Operations Assistant)
 */
router.post('/create-student', [
  authMiddleware,
  authorize(['hostel_operations_assistant']),
  body('admission_number')
    .notEmpty()
    .withMessage('Admission number is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('initial_room_assignment')
    .optional()
    .isUUID()
    .withMessage('Invalid room ID')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { admission_number, email, password, initial_room_assignment } = req.body;

  try {
    // Check if admission number exists in registry
    const { data: admissionRecord, error: admissionError } = await supabase
      .from('admission_registry')
      .select('*')
      .eq('admission_number', admission_number)
      .single();

    if (admissionError || !admissionRecord) {
      throw new ValidationError('Admission number not found in registry');
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for staff-created accounts
      user_metadata: {
        full_name: admissionRecord.student_name,
        role: 'student'
      }
    });

    if (authError) {
      throw new AuthenticationError('Failed to create user account');
    }

    // Create user record in our database
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: admissionRecord.student_name,
        role: 'student',
        auth_uid: authData.user.id,
        status: 'active'
      })
      .select()
      .single();

    if (userError) {
      // Clean up auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new ValidationError('Failed to create user profile');
    }

    // Create user profile
    const { data: profileRecord, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userRecord.id,
        admission_number: admission_number,
        course: admissionRecord.course,
        batch_year: admissionRecord.batch_year,
        parent_name: admissionRecord.parent_name,
        parent_phone: admissionRecord.parent_phone,
        parent_email: admissionRecord.parent_email,
        admission_number_verified: true,
        parent_contact_locked: true,
        status: 'complete'
      })
      .select()
      .single();

    if (profileError) {
      throw new ValidationError('Failed to create student profile');
    }

    // Create parent account if parent email doesn't exist
    const { data: existingParent } = await supabase
      .from('users')
      .select('id')
      .eq('email', admissionRecord.parent_email)
      .single();

    let parentUserId = null;
    if (!existingParent) {
      // Create parent auth user
      const { data: parentAuthData, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: admissionRecord.parent_email,
        password: 'temp_password_' + Math.random().toString(36).substring(7),
        email_confirm: false,
        user_metadata: {
          full_name: admissionRecord.parent_name,
          role: 'parent'
        }
      });

      if (!parentAuthError) {
        // Create parent user record
        const { data: parentUserRecord, error: parentUserError } = await supabase
          .from('users')
          .insert({
            id: parentAuthData.user.id,
            email: admissionRecord.parent_email,
            full_name: admissionRecord.parent_name,
            role: 'parent',
            auth_uid: parentAuthData.user.id,
            status: 'active'
          })
          .select()
          .single();

        if (!parentUserError) {
          parentUserId = parentUserRecord.id;

          // Create parent record with OTP
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

          await supabase
            .from('parents')
            .insert({
              user_id: parentUserId,
              student_profile_id: profileRecord.id,
              email: admissionRecord.parent_email,
              phone: admissionRecord.parent_phone,
              otp_code: otpCode,
              otp_expires_at: otpExpiresAt,
              verified: true // Auto-verify parents created by staff
            });

          // Send OTP email to parent
          try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const activationLink = `${frontendUrl}/activate?token=${activationToken}`;
            await sendActivationEmail({
              to: admissionRecord.parent_email,
              fullName: admissionRecord.parent_name,
              username: `PARENT-${admissionRecord.admission_number}`,
              activationLink,
              otpCode: otpCode
            });
          } catch (emailError) {
            console.error('Failed to send OTP email:', emailError);
            // Don't fail the entire operation for email issues
          }
        }
      }
    }

    // Assign room if specified
    if (initial_room_assignment) {
      const { error: allocationError } = await supabase
        .from('room_allocations')
        .insert({
          student_profile_id: profileRecord.id,
          room_id: initial_room_assignment,
          allocation_status: 'confirmed',
          created_by: req.user.id
        });

      if (allocationError) {
        console.error('Failed to assign initial room:', allocationError);
        // Don't fail the entire operation for room assignment issues
      }
    }

    res.status(201).json({
      success: true,
      message: 'Student account created successfully',
      data: {
        student: {
          id: userRecord.id,
          email: userRecord.email,
          fullName: userRecord.full_name,
          admissionNumber: admission_number
        },
        parentCreated: !!parentUserId,
        parentEmail: admissionRecord.parent_email
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/staff/admission-registry
 * @desc    Get admission registry entries
 * @access  Private (Staff)
 */
router.get('/admission-registry', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden'])
], asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('admission_registry')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`student_name.ilike.%${search}%,admission_number.ilike.%${search}%,course.ilike.%${search}%`);
  }

  const { data: records, error, count } = await query;

  if (error) {
    throw new ValidationError('Failed to fetch admission registry');
  }

  res.json({
    success: true,
    data: {
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    }
  });
}));

/**
 * @route   POST /api/staff/admission-registry
 * @desc    Add new admission registry entry
 * @access  Private (Staff)
 */
router.post('/admission-registry', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant']),
  body('admission_number')
    .notEmpty()
    .withMessage('Admission number is required'),
  body('student_name')
    .notEmpty()
    .withMessage('Student name is required'),
  body('course')
    .notEmpty()
    .withMessage('Course is required'),
  body('batch_year')
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Valid batch year is required'),
  body('parent_name')
    .notEmpty()
    .withMessage('Parent name is required'),
  body('parent_email')
    .isEmail()
    .withMessage('Valid parent email is required'),
  body('parent_phone')
    .isMobilePhone()
    .withMessage('Valid parent phone is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const {
    admission_number,
    student_name,
    course,
    batch_year,
    parent_name,
    parent_email,
    parent_phone
  } = req.body;

  const { data: record, error } = await supabase
    .from('admission_registry')
    .insert({
      admission_number,
      student_name,
      course,
      batch_year,
      parent_name,
      parent_email,
      parent_phone,
      added_by: req.user.id
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ValidationError('Admission number already exists');
    }
    throw new ValidationError('Failed to create admission record');
  }

  res.status(201).json({
    success: true,
    message: 'Admission record created successfully',
    data: { record }
  });
}));

/**
 * @route   GET /api/staff/pending-requests
 * @desc    Get pending room requests
 * @access  Private (Staff)
 */
router.get('/pending-requests', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant', 'warden'])
], asyncHandler(async (req, res) => {
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
 * @route   GET /api/staff/pending-data-review
 * @desc    Get data that needs manual review
 * @access  Private (Staff)
 */
router.get('/pending-data-review', [
  authMiddleware,
  authorize(['admin', 'hostel_operations_assistant'])
], asyncHandler(async (req, res) => {
  const { data: reviews, error } = await supabase
    .from('pending_data_review')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new ValidationError('Failed to fetch pending reviews');
  }

  res.json({
    success: true,
    data: { reviews }
  });
}));

module.exports = router;
