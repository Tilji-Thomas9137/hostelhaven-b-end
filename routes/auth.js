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
      redirectTo: `${process.env.CORS_ORIGIN}/auth/callback`,
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

    // Create user in Supabase Auth using admin client to bypass email confirmation
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
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

    // Create user profile in database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        phone,
        role
      })
      .select()
      .single();

    if (profileError) {
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new ValidationError('Failed to create user profile');
    }

    // Send welcome email (optional)
    // await sendWelcomeEmail(email, fullName);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          role: userProfile.role,
          createdAt: userProfile.created_at
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
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new AuthenticationError('User profile not found');
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
      redirectTo: `${process.env.CORS_ORIGIN}/reset-password`
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
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select(`
        *,
        hostels(name, city, state),
        rooms(room_number, floor, room_type)
      `)
      .eq('id', req.user.id)
      .single();

    if (error || !userProfile) {
      throw new AuthenticationError('User profile not found');
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
          hostel: userProfile.hostels,
          room: userProfile.rooms,
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
    .withMessage('Please provide a valid phone number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { fullName, phone } = req.body;

  try {
    const updates = {};
    if (fullName) updates.full_name = fullName;
    if (phone) updates.phone = phone;

    const { data: userProfile, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      throw new ValidationError('Failed to update profile');
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