const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

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

  // Check if user exists in our database
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!userProfile) {
    // Create user profile if it doesn't exist with default role as student
    const { data: newProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
        phone: null, // Google OAuth doesn't provide phone numbers
        role: 'student' // Default role for Google OAuth users
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw new ValidationError('Failed to create user profile');
    }
  } else {
    // If user exists but doesn't have a role, update it to student
    if (!userProfile.role) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'student' })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Role update error:', updateError);
      }
    }
  }

  // Get the final user profile (either existing or newly created)
  const { data: finalUserProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

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

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .custom((value) => {
      // Additional email validation if needed
      if (!value || value.length < 5) {
        throw new Error('Email must be at least 5 characters long');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('role')
    .optional()
    .isIn(['student', 'admin', 'hostel_operations_assistant', 'warden', 'parent'])
    .withMessage('Invalid role specified')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, password, fullName, phone, role = 'student' } = req.body;

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create user in Supabase Auth - requires email confirmation
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        full_name: fullName,
        phone: phone, // Include phone number in metadata
        role: role
      }
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      // Handle specific Supabase errors
      if (authError.message.includes('Email address') && authError.message.includes('is invalid')) {
        throw new ValidationError('Please provide a valid email address');
      }
      throw new AuthenticationError(authError.message);
    }

    // Don't create user profile yet - wait for email confirmation
    // The profile will be created when the user first logs in after confirming email

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to confirm your account.',
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          fullName: fullName,
          role: role
        }
      }
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
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

  try {
    // Authenticate user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Get user profile
    let { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If user profile doesn't exist, create it with default role as student
    if (profileError || !userProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          full_name: authData.user.user_metadata?.full_name || authData.user.email.split('@')[0],
          phone: authData.user.user_metadata?.phone || null, // Extract phone from metadata
          role: authData.user.user_metadata?.role || 'student', // Use role from metadata or default to student
          password_hash: 'oauth_user' // Placeholder for OAuth users
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Profile creation error in login:', createError);
        throw new AuthenticationError('Failed to create user profile');
      }

      userProfile = newProfile;
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
      .select('*')
      .eq('id', req.user.id)
      .single();

    // If user profile doesn't exist, create it with default role as student
    if (error || !userProfile) {
      const { data: newProfile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: req.user.id,
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
          updatedAt: userProfile.updated_at
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
      .eq('id', req.user.id)
      .single();

    // If user profile doesn't exist, create it first
    if (error || !userProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert({
          id: req.user.id,
          email: req.user.email,
          full_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
          phone: req.user.user_metadata?.phone || null, // Extract phone from metadata
          role: req.user.user_metadata?.role || 'student', // Use role from metadata or default to student
          password_hash: null, // OAuth users don't have password hashes
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
        .eq('id', req.user.id)
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