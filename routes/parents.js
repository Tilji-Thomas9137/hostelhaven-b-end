const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { sendActivationEmail } = require('../utils/resend-mailer');

const router = express.Router();

/**
 * @route   POST /api/parents/send-otp
 * @desc    Send OTP to parent email
 * @access  Private (Staff or Parent)
 */
router.post('/send-otp', [
  authMiddleware,
  body('parent_email')
    .isEmail()
    .withMessage('Valid parent email is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { parent_email } = req.body;
  const userRole = req.user.role;

  try {
    // Check if user is staff or the parent themselves
    if (!['admin', 'hostel_operations_assistant', 'warden', 'parent'].includes(userRole)) {
      throw new AuthenticationError('Unauthorized');
    }

    // If parent, verify they're requesting for their own email
    if (userRole === 'parent') {
      const { data: parentUser } = await supabase
        .from('users')
        .select('email')
        .eq('auth_uid', req.user.id)
        .single();

      if (!parentUser || parentUser.email !== parent_email) {
        throw new AuthenticationError('You can only request OTP for your own email');
      }
    }

    // Find parent record
    const { data: parentRecord, error: parentError } = await supabase
      .from('parents')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(full_name)
        )
      `)
      .eq('email', parent_email)
      .single();

    if (parentError || !parentRecord) {
      throw new ValidationError('Parent record not found');
    }

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update parent record with new OTP
    const { error: updateError } = await supabase
      .from('parents')
      .update({
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        verified: false
      })
      .eq('id', parentRecord.id);

    if (updateError) {
      throw new ValidationError('Failed to generate OTP');
    }

    // Send OTP email
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=parent-verification`;
      await sendActivationEmail({
        to: parent_email,
        fullName: parentRecord.user_profiles.users.full_name,
        username: `PARENT-${parentRecord.user_profiles.admission_number}`,
        activationLink,
        otpCode: otpCode
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      throw new ValidationError('Failed to send OTP email');
    }

    res.json({
      success: true,
      message: 'OTP sent successfully to parent email'
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parents/verify-otp
 * @desc    Verify OTP and activate parent account
 * @access  Private (Parent)
 */
router.post('/verify-otp', [
  authMiddleware,
  authorize(['parent']),
  body('otp_code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Valid 6-digit OTP is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { otp_code } = req.body;

  try {
    // Get parent record
    const { data: parentRecord, error: parentError } = await supabase
      .from('parents')
      .select(`
        *,
        user_profiles!inner(
          admission_number,
          users!inner(full_name)
        )
      `)
      .eq('user_id', req.user.id)
      .single();

    if (parentError || !parentRecord) {
      throw new ValidationError('Parent record not found');
    }

    // Check if already verified
    if (parentRecord.verified) {
      throw new ValidationError('Parent account is already verified');
    }

    // Check OTP
    if (!parentRecord.otp_code || parentRecord.otp_code !== otp_code) {
      throw new ValidationError('Invalid OTP code');
    }

    // Check if OTP is expired
    if (!parentRecord.otp_expires_at || new Date() > new Date(parentRecord.otp_expires_at)) {
      throw new ValidationError('OTP code has expired');
    }

    // Verify parent account
    const { error: verifyError } = await supabase
      .from('parents')
      .update({
        verified: true,
        otp_code: null,
        otp_expires_at: null
      })
      .eq('id', parentRecord.id);

    if (verifyError) {
      throw new ValidationError('Failed to verify parent account');
    }

    // Send confirmation email
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/parent-dashboard`;
      await sendActivationEmail({
        to: parentRecord.email,
        fullName: parentRecord.user_profiles.users.full_name,
        username: `PARENT-${parentRecord.user_profiles.admission_number}`,
        activationLink,
        otpCode: 'VERIFIED'
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the operation for email issues
    }

    res.json({
      success: true,
      message: 'Parent account verified successfully'
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parents/child-info
 * @desc    Get child information (verified parents only)
 * @access  Private (Parent)
 */
router.get('/child-info', [
  authMiddleware
], asyncHandler(async (req, res) => {
  try {
    // Resolve current app user record
    const { data: appUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (!appUser) {
      throw new ValidationError('User not found');
    }

    // Try to get parent record linked to this user
    let { data: parentRecord } = await supabase
      .from('parents')
      .select(`
        *,
        user_profiles!inner(
          *,
          users!inner(id, full_name, email, phone, room_id)
        )
      `)
      .eq('user_id', appUser.id)
      .maybeSingle();

    // If no parent record, attempt auto-link by matching parent email on user_profiles
    if (!parentRecord) {
      const { data: candidateProfile } = await supabase
        .from('user_profiles')
        .select(`
          *,
          users!inner(id, full_name, email, phone, room_id)
        `)
        .eq('parent_email', appUser.email)
        .maybeSingle();

      if (candidateProfile) {
        const insertRes = await supabase
          .from('parents')
          .insert({
            user_id: appUser.id,
            student_profile_id: candidateProfile.id,
            email: appUser.email,
            phone: candidateProfile.parent_phone || null,
            verified: true
          })
          .select(`
            *,
            user_profiles!inner(
              *,
              users!inner(id, full_name, email, phone, room_id)
            )
          `)
          .single();

        parentRecord = insertRes.data || null;

        // Optionally update role to parent
        if (appUser.role !== 'parent') {
          await supabase.from('users').update({ role: 'parent' }).eq('id', appUser.id);
        }
      }
    }

    if (!parentRecord) {
      throw new AuthenticationError('Parent not linked. Please contact admin to link your account.');
    }

    // If parent exists but is not verified, auto-verify on first access
    if (!parentRecord.verified) {
      const { error: verifyError } = await supabase
        .from('parents')
        .update({ verified: true, otp_code: null, otp_expires_at: null })
        .eq('id', parentRecord.id);

      if (!verifyError) {
        parentRecord.verified = true;
      }
      // If verification update fails, continue without blocking access
    }

    // Get child's academic info, payments, etc.
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', parentRecord.user_profiles.user_id)
      .order('due_date', { ascending: false })
      .limit(10);

    const { data: leaveRequests } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', parentRecord.user_profiles.user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: complaints } = await supabase
      .from('complaints')
      .select('*')
      .eq('user_id', parentRecord.user_profiles.user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get room allocation data - try multiple methods to find room
    let roomAllocation = null;
    
    console.log('🔍 Parent API - Looking for room allocation for student_profile_id:', parentRecord.user_profiles.id);
    console.log('🔍 Parent API - Student user_id:', parentRecord.user_profiles.user_id);
    console.log('🔍 Parent API - Users room_id:', parentRecord.user_profiles.users?.room_id);
    
    // Method 1: Try via room_allocations using student_profile_id
    const { data: allocation1, error: allocError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        room_id,
        allocation_status,
        allocation_date,
        start_date,
        end_date,
        rooms(
          id,
          room_number,
          floor,
          room_type,
          capacity,
          price,
          status
        )
      `)
      .eq('student_profile_id', parentRecord.user_profiles.id)
      .in('allocation_status', ['confirmed', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('🔍 Method 1 - room_allocations result:', allocation1 ? 'Found' : 'Not found');
    if (allocError) console.error('❌ Method 1 error:', allocError);

    if (allocation1) {
      roomAllocation = allocation1;
      console.log('✅ Using room allocation from room_allocations table');
    } else {
      // Method 2: Try via users.room_id (this is updated when HO approves room request)
      const userRoomId = parentRecord.user_profiles.users?.room_id;
      console.log('🔍 Method 2 - Trying users.room_id:', userRoomId);
      
      if (userRoomId) {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', userRoomId)
          .single();
        
        console.log('🔍 Method 2 - Room data result:', roomData ? 'Found' : 'Not found');
        if (roomError) console.error('❌ Method 2 error:', roomError);
        
        if (roomData) {
          roomAllocation = {
            room_id: roomData.id,
            allocation_status: 'confirmed',
            rooms: roomData
          };
          console.log('✅ Using room data from users.room_id (updated by HO approval)');
        }
      } else {
        console.log('⚠️ No room assignment found for this student');
      }
    }

    console.log('🎯 Final roomAllocation:', roomAllocation);

    // Get admission registry data for admission_number and course
    const { data: admissionRegistry } = await supabase
      .from('admission_registry')
      .select('*')
      .eq('user_id', parentRecord.user_profiles.user_id)
      .maybeSingle();

    // Merge admission_registry data into profile for better data access
    const enrichedProfile = {
      ...parentRecord.user_profiles,
      admission_number: admissionRegistry?.admission_number || parentRecord.user_profiles.admission_number,
      course: admissionRegistry?.course || parentRecord.user_profiles.course
    };

    res.json({
      success: true,
      data: {
        child: {
          profile: enrichedProfile,
          payments: payments || [],
          leaveRequests: leaveRequests || [],
          complaints: complaints || [],
          roomAllocation: roomAllocation || null,
          admissionRegistry: admissionRegistry || null
        },
        parent: {
          email: parentRecord.email,
          phone: parentRecord.phone,
          verified: parentRecord.verified
        }
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/parents/update-phone
 * @desc    Update parent phone number and sync to child's profile
 * @access  Private (Parent)
 */
router.put('/update-phone', [
  authMiddleware,
  body('phone')
    .isMobilePhone('any')
    .withMessage('Valid phone number is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { phone } = req.body;

  try {
    // Get current app user
    const { data: appUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (!appUser) {
      throw new ValidationError('User not found');
    }

    // Get parent record
    const { data: parentRecord } = await supabase
      .from('parents')
      .select('*, user_profiles!inner(id, user_id)')
      .eq('user_id', appUser.id)
      .single();

    if (!parentRecord) {
      throw new ValidationError('Parent record not found');
    }

    // Update parent phone in parents table
    const { error: parentUpdateError } = await supabase
      .from('parents')
      .update({ phone })
      .eq('id', parentRecord.id);

    if (parentUpdateError) {
      throw new ValidationError('Failed to update parent phone');
    }

    // Update parent phone in users table
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ phone })
      .eq('id', appUser.id);

    if (userUpdateError) {
      console.error('Failed to update user phone:', userUpdateError);
    }

    // Update parent_phone in child's user_profiles table
    if (parentRecord.user_profiles) {
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update({ parent_phone: phone })
        .eq('id', parentRecord.user_profiles.id);

      if (profileUpdateError) {
        console.error('Failed to update child profile parent_phone:', profileUpdateError);
      }
    }

    // Also update parent_phone in admission_registry table if it exists
    const { error: registryUpdateError } = await supabase
      .from('admission_registry')
      .update({ parent_phone: phone })
      .eq('user_id', parentRecord.user_profiles.user_id);

    if (registryUpdateError) {
      console.error('Failed to update admission registry parent_phone:', registryUpdateError);
      // Don't fail the entire operation if registry update fails
    }

    res.json({
      success: true,
      message: 'Phone number updated successfully',
      data: { phone }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parents/verification-status
 * @desc    Get parent verification status
 * @access  Private (Parent)
 */
router.get('/verification-status', [
  authMiddleware,
  authorize(['parent'])
], asyncHandler(async (req, res) => {
  try {
    const { data: parentRecord, error } = await supabase
      .from('parents')
      .select('verified, otp_code, otp_expires_at')
      .eq('user_id', req.user.id)
      .single();

    if (error || !parentRecord) {
      throw new ValidationError('Parent record not found');
    }

    res.json({
      success: true,
      data: {
        verified: parentRecord.verified,
        hasActiveOtp: !!parentRecord.otp_code && new Date() < new Date(parentRecord.otp_expires_at)
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parents/debug-room-data
 * @desc    Debug endpoint to check room data for parent's child
 * @access  Private (Parent)
 */
router.get('/debug-room-data', [
  authMiddleware
], asyncHandler(async (req, res) => {
  try {
    // Resolve current app user record
    const { data: appUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (!appUser) {
      throw new ValidationError('User not found');
    }

    // Get parent record
    const { data: parentRecord } = await supabase
      .from('parents')
      .select(`
        *,
        user_profiles!inner(
          *,
          users!inner(id, full_name, email, phone, room_id)
        )
      `)
      .eq('user_id', appUser.id)
      .maybeSingle();

    if (!parentRecord) {
      throw new ValidationError('Parent not found');
    }

    // Get room allocation
    const { data: roomAllocation } = await supabase
      .from('room_allocations')
      .select(`
        *,
        rooms(
          *
        )
      `)
      .eq('student_profile_id', parentRecord.user_profiles.id)
      .in('allocation_status', ['confirmed', 'active'])
      .maybeSingle();

    res.json({
      success: true,
      debug: {
        studentProfileId: parentRecord.user_profiles.id,
        studentUserId: parentRecord.user_profiles.user_id,
        usersRoomId: parentRecord.user_profiles.users?.room_id,
        roomAllocation: roomAllocation,
        allRoomAllocations: null
      }
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;
