const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

/**
 * @route   POST /api/parent-verification/send-otp
 * @desc    Send OTP to parent email for first-time login
 * @access  Public
 */
router.post('/send-otp', [
  body('email').isEmail().withMessage('Valid email is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email } = req.body;

  try {
    // Check if parent exists in parents table
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, email, verified')
      .eq('email', email)
      .single();

    if (parentError || !parent) {
      throw new ValidationError('Parent email not found in our records');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes

    // Store OTP with expiry
    otpStore.set(email, {
      otp,
      expiry: otpExpiry,
      attempts: 0
    });

    // In a real application, you would send this via email service
    // For now, we'll just log it (remove this in production)
    console.log(`OTP for ${email}: ${otp}`);

    // TODO: Implement actual email sending
    // await sendOTPEmail(email, otp);

    res.json({
      success: true,
      data: {
        message: 'OTP sent to your email address',
        // Remove this in production
        otp: otp
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/parent-verification/verify-otp
 * @desc    Verify OTP and create parent auth session
 * @access  Public
 */
router.post('/verify-otp', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, otp } = req.body;

  try {
    // Get stored OTP
    const storedData = otpStore.get(email);
    if (!storedData) {
      throw new ValidationError('OTP not found or expired. Please request a new OTP.');
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiry) {
      otpStore.delete(email);
      throw new ValidationError('OTP has expired. Please request a new OTP.');
    }

    // Check attempts limit
    if (storedData.attempts >= 3) {
      otpStore.delete(email);
      throw new ValidationError('Too many failed attempts. Please request a new OTP.');
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      throw new ValidationError('Invalid OTP. Please try again.');
    }

    // OTP is valid, get parent details
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select(`
        id,
        email,
        phone,
        verified
      `)
      .eq('email', email)
      .single();

    if (parentError || !parent) {
      throw new ValidationError('Parent not found');
    }

    // Check if parent already has auth account
    let authUser;
    try {
      const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      authUser = existingAuth.user;
      
      // If user exists, make sure they have a record in the users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', authUser.id)
        .single();
        
      if (!existingUser) {
        // Create user record if it doesn't exist
        const { data: newUser, error: userCreateError } = await supabase
          .from('users')
          .insert({
            auth_uid: authUser.id,
            email: email,
            role: 'parent',
            status: 'active',
            full_name: parent.email.split('@')[0]
          })
          .select()
          .single();

        if (userCreateError) {
          console.warn(`Failed to create user record: ${userCreateError.message}`);
        } else if (newUser) {
          // Update the parent record to link with the user
          const { error: parentUpdateError } = await supabase
            .from('parents')
            .update({ user_id: newUser.id })
            .eq('id', parent.id);

          if (parentUpdateError) {
            console.warn(`Failed to link parent to user: ${parentUpdateError.message}`);
          }
        }
      }
    } catch (error) {
      // Parent doesn't have auth account, create one
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: crypto.randomBytes(32).toString('hex'), // Random password
        email_confirm: true,
        user_metadata: {
          role: 'parent',
          full_name: parent.email.split('@')[0] // Use email prefix as name
        }
      });

      if (createError) {
        throw new Error(`Failed to create parent auth account: ${createError.message}`);
      }

      authUser = newAuthUser.user;

      // Create user record in users table
      const { data: newUser, error: userCreateError } = await supabase
        .from('users')
        .insert({
          auth_uid: authUser.id,
          email: email,
          role: 'parent',
          status: 'active',
          full_name: parent.email.split('@')[0]
        })
        .select()
        .single();

      if (userCreateError) {
        console.warn(`Failed to create user record: ${userCreateError.message}`);
      } else if (newUser) {
        // Update the parent record to link with the new user
        const { error: parentUpdateError } = await supabase
          .from('parents')
          .update({ user_id: newUser.id })
          .eq('id', parent.id);

        if (parentUpdateError) {
          console.warn(`Failed to link parent to user: ${parentUpdateError.message}`);
        }
      }
    }

    // Update parent verification status
    if (!parent.verified) {
      const { error: updateError } = await supabase
        .from('parents')
        .update({ 
          verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', parent.id);

      if (updateError) {
        console.warn(`Failed to update parent verification status: ${updateError.message}`);
      }
    }

    // Generate a proper session using admin client
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/parent-dashboard`
      }
    });

    if (sessionError) {
      throw new Error(`Failed to generate session: ${sessionError.message}`);
    }

    // Clean up OTP
    otpStore.delete(email);

    res.json({
      success: true,
      data: {
        parent: {
          ...parent,
          verified: true
        },
        auth_uid: authUser.id,
        session_url: sessionData.properties?.action_link,
        message: 'OTP verified successfully'
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parent-verification/child-info
 * @desc    Get parent's child information
 * @access  Private (Parent)
 */
router.get('/child-info', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get parent details
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, email, verified')
      .eq('email', req.user.email)
      .single();

    if (parentError || !parent) {
      throw new AuthorizationError('Parent not found');
    }

    if (!parent.verified) {
      throw new AuthorizationError('Parent account not verified');
    }

    // Get child's user profile through parent relationship
    const { data: childProfile, error: childError } = await supabase
      .from('parents')
      .select(`
        user_profiles!inner(
          *,
          users!inner(full_name, email, phone)
        )
      `)
      .eq('email', req.user.email)
      .single();

    if (childError || !childProfile) {
      throw new ValidationError('Child information not found');
    }

    const child = childProfile.user_profiles;

    if (childError || !child) {
      throw new ValidationError('Child information not found');
    }

    // Get child's room details if exists
    const userProfile = child;

    // Get room details if child has room
    let roomDetails = null;
    if (userProfile?.room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select(`
          id,
          room_number,
          floor,
          room_type,
          capacity,
          current_occupancy
        `)
        .eq('id', userProfile.room_id)
        .single();

      roomDetails = room;
    }

    res.json({
      success: true,
      data: {
        child: {
          ...child,
          room: roomDetails,
          profile_status: userProfile?.status || 'not_activated'
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parent-verification/child-leave-history
 * @desc    Get parent's child leave history
 * @access  Private (Parent)
 */
router.get('/child-leave-history', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get parent details
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, verified')
      .eq('email', req.user.email)
      .single();

    if (parentError || !parent || !parent.verified) {
      throw new AuthorizationError('Parent not found or not verified');
    }

    // Get child's user profile
    const { data: childProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', parent.id)
      .single();

    if (profileError || !childProfile) {
      throw new ValidationError('Child profile not found');
    }

    // Get leave requests
    const { data: leaveRequests, error } = await supabase
      .from('leave_requests')
      .select(`
        id,
        start_date,
        end_date,
        reason,
        status,
        created_at,
        processed_at
      `)
      .eq('user_id', childProfile.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch leave history: ${error.message}`);
    }

    res.json({
      success: true,
      data: { leave_requests: leaveRequests || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parent-verification/child-payments
 * @desc    Get parent's child payment history
 * @access  Private (Parent)
 */
router.get('/child-payments', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get parent details
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, verified')
      .eq('email', req.user.email)
      .single();

    if (parentError || !parent || !parent.verified) {
      throw new AuthorizationError('Parent not found or not verified');
    }

    // Get child's user profile
    const { data: childProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', parent.id)
      .single();

    if (profileError || !childProfile) {
      throw new ValidationError('Child profile not found');
    }

    // Get payment history
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_type,
        status,
        created_at,
        due_date
      `)
      .eq('user_id', childProfile.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payment history: ${error.message}`);
    }

    res.json({
      success: true,
      data: { payments: payments || [] }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/parent-verification/announcements
 * @desc    Get hostel announcements for parents
 * @access  Private (Parent)
 */
router.get('/announcements', authMiddleware, asyncHandler(async (req, res) => {
  try {
    // Get announcements (assuming there's an announcements table)
    const { data: announcements, error } = await supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        type,
        created_at
      `)
      .eq('type', 'announcement')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch announcements: ${error.message}`);
    }

    res.json({
      success: true,
      data: { announcements: announcements || [] }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router;
