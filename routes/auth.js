const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { body: vBody } = require('express-validator');
const { asyncHandler: ah2 } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth login
 * @access  Public
 */
router.get('/google', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `http://localhost:5173/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw new AuthenticationError(error.message);
  }

  res.json({
    success: true,
    data: {
      url: data.url
    }
  });
}));
// Account activation with token + OTP
router.post('/activate', [
  body('token').notEmpty().withMessage('Activation token is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { token, otp, password } = req.body;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('activation_token', token)
    .single();

  if (userError || !user) {
    throw new ValidationError('Invalid activation token');
  }

  if (!user.activation_expires_at || new Date(user.activation_expires_at).getTime() < Date.now()) {
    throw new ValidationError('Activation token has expired');
  }

  if (!user.otp_code || user.otp_code !== otp) {
    throw new ValidationError('Invalid OTP');
  }

  if (!user.otp_expires_at || new Date(user.otp_expires_at).getTime() < Date.now()) {
    throw new ValidationError('OTP has expired');
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true
  });

  if (authError) {
    throw new ValidationError('Failed to create authentication account');
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      auth_uid: authUser.user.id,
      status: 'available',
      activation_token: null,
      activation_expires_at: null,
      otp_code: null,
      otp_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (updateError) {
    throw new ValidationError('Failed to finalize activation');
  }

  // If this is a parent account, also verify them in the parents table
  if (user.role === 'parent') {
    try {
      const { error: parentVerifyError } = await supabase
        .from('parents')
        .update({
          verified: true,
          otp_code: null,
          otp_expires_at: null
        })
        .eq('user_id', user.id);

      if (parentVerifyError) {
        console.error('Failed to verify parent during activation:', parentVerifyError);
        // Don't fail the activation for this, just log the error
      } else {
        console.log('Parent automatically verified during activation');
      }
    } catch (error) {
      console.error('Error verifying parent during activation:', error);
      // Don't fail the activation for this
    }
  }

  res.json({
    success: true,
    message: 'Account activated successfully. You can now log in.',
    data: { role: updatedUser.role }
  });
}));

/**
 * @route   POST /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.post('/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new ValidationError('Authorization code is required');
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    throw new AuthenticationError(error.message);
  }

  // Check if user exists in our database by auth_uid
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_uid', data.user.id)
    .single();

  if (!userProfile) {
    // No automatic user creation - users must be created by staff
    throw new AuthenticationError('Your account is not yet activated by hostel staff. Please contact the hostel administration.');
  }

  // Use the found user profile
  const finalUserProfile = userProfile;

  res.json({
    success: true,
    message: 'Google authentication successful',
    data: {
      user: {
        id: finalUserProfile.id,
        email: finalUserProfile.email,
        fullName: finalUserProfile.full_name,
        role: finalUserProfile.role,
        phone: finalUserProfile.phone,
        createdAt: finalUserProfile.created_at
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      }
    }
  });
}));

// Registration endpoint removed - users must be created by staff via /api/hostel_assistant/create-student

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email')
    .notEmpty()
    .withMessage('Please provide an email or username'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, password } = req.body;
  let loginEmail = email;

  // Support username-based login (e.g., admission_number) by resolving to email
  if (typeof loginEmail === 'string' && !loginEmail.includes('@')) {
    const { data: userByUsername } = await supabase
      .from('users')
      .select('email')
      .eq('username', loginEmail)
      .single();

    if (!userByUsername || !userByUsername.email) {
      throw new AuthenticationError('Invalid email/username or password');
    }
    loginEmail = userByUsername.email;
  }

  try {
    // Authenticate user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password
    });

    if (authError) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Link profile by auth_uid or email if not linked yet
    let { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authData.user.id)
      .single();

    if (!userProfile) {
      const { data: byEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', authData.user.email)
        .single();
      if (byEmail) {
        // Attach auth_uid on first successful login
        const { data: linked } = await supabase
          .from('users')
          .update({ auth_uid: authData.user.id, status: byEmail.status || 'available' })
          .eq('id', byEmail.id)
          .select()
          .single();
        userProfile = linked || byEmail;
      }
    }

    // Check if user is suspended before proceeding
    if (userProfile && userProfile.status === 'suspended') {
      throw new AuthenticationError('Your account has been suspended. Please contact an administrator.');
    }

    // If user profile doesn't exist, this means the user wasn't created by staff
    // For our secure system, we don't allow automatic user creation
    if (!userProfile) {
      throw new AuthenticationError('Your account is not yet activated by hostel staff. Please contact the hostel administration.');
    }

  res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
          phone: userProfile.phone,
          hostelId: userProfile.hostel_id,
          roomId: userProfile.room_id,
          createdAt: userProfile.created_at
        },
        session: {
          accessToken: authData.session.access_token,
          refreshToken: authData.session.refresh_token,
          expiresAt: authData.session.expires_at
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new AuthenticationError('Logout failed');
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { refreshToken } = req.body;

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email } = req.body;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:5173/reset-password`
    });

    if (error) {
      throw new AuthenticationError('Failed to send password reset email');
    }

    res.json({
      success: true,
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { password } = req.body;
  const token = req.query.token || req.body.token;

  if (!token) {
    throw new ValidationError('Reset token is required');
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      throw new AuthenticationError('Failed to reset password');
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/auth/check-email
 * @desc    Check if email is available for registration
 * @access  Public
 */
router.get('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email parameter is required'
    });
  }

  try {
    // Check if user exists in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw new AuthenticationError('Failed to check email availability');
    }

    const userExists = authUser.users.some(user => user.email === email);

    res.json({
      success: true,
      available: !userExists,
      message: userExists ? 'Email is already registered' : 'Email is available'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/resend-confirmation
 * @desc    Resend email confirmation for unconfirmed users
 * @access  Public
 */
router.post('/resend-confirmation', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email } = req.body;

  try {
    // Check if user exists and is unconfirmed
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw new AuthenticationError('Failed to check user status');
    }

    const user = authUser.users.find(u => u.email === email);
    
    if (!user) {
      throw new ValidationError('No account found with this email address');
    }

    if (user.email_confirmed_at) {
      throw new ValidationError('Email is already confirmed. Please try logging in.');
    }

    // Resend confirmation email
    const { error: resendError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `http://localhost:5173/auth/callback`
      }
    });

    if (resendError) {
      throw new AuthenticationError('Failed to resend confirmation email');
    }

    res.json({
      success: true,
      message: 'Confirmation email sent successfully. Please check your email.'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  try {
    let { data: userProfile, error } = await supabase
      .from('users')
      .select(`
        *,
        user_profiles(
          admission_number,
          course,
          batch_year,
          date_of_birth,
          address,
          city,
          state,
          country,
          emergency_contact_name,
          emergency_contact_phone,
          parent_name,
          parent_phone,
          parent_email,
          aadhar_number,
          blood_group,
          join_date,
          profile_status,
          status,
          bio,
          avatar_url,
          pincode,
          admission_number_verified,
          parent_contact_locked
        )
      `)
      .eq('auth_uid', req.user.id)
      .single();

    // If user profile doesn't exist, create it with default role as student
    if (error || !userProfile) {
      const { data: newProfile, error: profileError } = await supabase
        .from('users')
        .insert({
          auth_uid: req.user.id,
          email: req.user.email,
          full_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
          phone: req.user.user_metadata?.phone || null,
          role: req.user.user_metadata?.role || 'student',
          password_hash: 'oauth_user' // Placeholder for OAuth users
        })
        .select('*')
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new AuthenticationError('Failed to create user profile');
      }

      userProfile = newProfile;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatar_url,
          hostelId: userProfile.hostel_id || null,
          roomId: userProfile.room_id || null,
          createdAt: userProfile.created_at,
          updatedAt: userProfile.updated_at,
          // Include student profile data if available
          profile: userProfile.user_profiles ? {
            admissionNumber: userProfile.user_profiles.admission_number,
            course: userProfile.user_profiles.course,
            batchYear: userProfile.user_profiles.batch_year,
            dateOfBirth: userProfile.user_profiles.date_of_birth,
            address: userProfile.user_profiles.address,
            city: userProfile.user_profiles.city,
            state: userProfile.user_profiles.state,
            country: userProfile.user_profiles.country,
            emergencyContactName: userProfile.user_profiles.emergency_contact_name,
            emergencyContactPhone: userProfile.user_profiles.emergency_contact_phone,
            parentName: userProfile.user_profiles.parent_name,
            parentPhone: userProfile.user_profiles.parent_phone,
            parentEmail: userProfile.user_profiles.parent_email,
            aadharNumber: userProfile.user_profiles.aadhar_number,
            bloodGroup: userProfile.user_profiles.blood_group,
            joinDate: userProfile.user_profiles.join_date,
            profileStatus: userProfile.user_profiles.profile_status,
            status: userProfile.user_profiles.status,
            bio: userProfile.user_profiles.bio,
            avatarUrl: userProfile.user_profiles.avatar_url,
            pincode: userProfile.user_profiles.pincode,
            admissionNumberVerified: userProfile.user_profiles.admission_number_verified,
            parentContactLocked: userProfile.user_profiles.parent_contact_locked
          } : null
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authMiddleware, [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Please provide a valid avatar URL')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { fullName, phone, avatarUrl } = req.body;

  try {
    const updates = {};
    if (fullName) updates.full_name = fullName;
    if (phone) updates.phone = phone;
    if (avatarUrl) updates.avatar_url = avatarUrl;

    // First check if user profile exists
    let { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', req.user.id)
      .single();

    // If user profile doesn't exist, create it first
    if (error || !userProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          auth_uid: req.user.id,
          email: req.user.email,
          full_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
          phone: req.user.user_metadata?.phone || null, // Extract phone from metadata
          role: req.user.user_metadata?.role || 'student', // Use role from metadata or default to student
          password_hash: 'oauth_user', // Placeholder for OAuth users
          ...updates // Include any updates in the initial creation
        })
        .select()
        .single();

      if (createError) {
        console.error('Profile creation error in update:', createError);
        throw new ValidationError('Failed to create user profile');
      }

      userProfile = newProfile;
    } else {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('auth_uid', req.user.id)
        .select()
        .single();

      if (updateError) {
        throw new ValidationError('Failed to update profile');
      }

      userProfile = updatedProfile;

      // Also update Supabase Auth user metadata if phone or fullName is updated
      if (fullName || phone) {
        const metadataUpdates = {};
        if (fullName) metadataUpdates.full_name = fullName;
        if (phone) metadataUpdates.phone = phone;

        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
          req.user.id,
          { user_metadata: metadataUpdates }
        );

        if (metadataError) {
          console.error('Metadata update error:', metadataError);
          // Don't throw error here as the profile was updated successfully
        }
      }
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatar_url,
          updatedAt: userProfile.updated_at
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

module.exports = router; 