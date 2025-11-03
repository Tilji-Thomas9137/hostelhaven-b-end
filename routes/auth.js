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

  // If this user already has an auth account, skip creation and just finalize activation
  if (user.auth_uid) {
    const { data: updatedUserExisting, error: updateExistingErr } = await supabase
      .from('users')
      .update({
        status: 'active',
        activation_token: null,
        activation_expires_at: null,
        otp_code: null,
        otp_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateExistingErr) {
      throw new ValidationError('Failed to finalize activation');
    }

    // Ensure/activate a corresponding user_profiles row for this user
    try {
      const { data: existingProfile2 } = await supabase
        .from('user_profiles')
        .select('id, profile_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile2) {
        if (existingProfile2.profile_status !== 'active') {
          await supabase
            .from('user_profiles')
            .update({ profile_status: 'active' })
            .eq('id', existingProfile2.id);
        }
      } else {
        const admissionNumber2 = user.linked_admission_number || user.username || null;
        await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            admission_number: admissionNumber2,
            profile_status: 'active',
            status: 'incomplete'
          });
      }
    } catch (e) {
      console.warn('Activation finalize (pre-existing auth) warning:', e.message);
    }

    return res.json({
      success: true,
      message: 'Account activated successfully. You can now log in.',
      data: { role: updatedUserExisting.role }
    });
  }

  // Check if user already exists in Supabase Auth
  try {
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.getUserByEmail(user.email);
    if (existingAuthUser.user) {
      console.log('🔍 ACTIVATION: User already exists in Supabase Auth, linking existing account');
      // Link the existing auth user to our database user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          auth_uid: existingAuthUser.user.id,
          status: 'active',
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
        console.error('❌ ACTIVATION: Failed to link existing auth user:', updateError);
        throw new ValidationError('Failed to link existing authentication account');
      }

      // Continue with profile activation
      try {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id, profile_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingProfile) {
          if (existingProfile.profile_status !== 'active') {
            await supabase
              .from('user_profiles')
              .update({ profile_status: 'active' })
              .eq('id', existingProfile.id);
          }
        } else {
          const admissionNumber = user.linked_admission_number || user.username || null;
          await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              admission_number: admissionNumber,
              profile_status: 'active',
              status: 'incomplete'
            });
        }
      } catch (e) {
        console.warn('Activation: unable to ensure/activate user profile:', e.message);
      }

      res.json({
        success: true,
        message: 'Account activated successfully. You can now log in.',
        data: { role: updatedUser.role }
      });
      return;
    }
  } catch (authCheckError) {
    console.log('🔍 ACTIVATION: No existing auth user found, proceeding with creation');
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true
  });

  if (authError) {
    // If the auth user already exists, link it and finalize activation
    if (authError.status === 422 || authError.code === 'email_exists') {
      try {
        let { data: byEmail } = await supabaseAdmin.auth.admin.getUserByEmail(user.email);
        let existingAuth = byEmail?.user || byEmail; // support both shapes
        // Fallback: scan users if direct lookup missed (case differences)
        if (!existingAuth?.id) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          const found = list?.users?.find(u => (u.email || '').toLowerCase() === (user.email || '').toLowerCase());
          if (found) existingAuth = found;
        }
        if (existingAuth?.id) {
          const { data: updatedUserExisting, error: updateExistingErr } = await supabase
            .from('users')
            .update({
              auth_uid: existingAuth.id,
              status: 'active',
              activation_token: null,
              activation_expires_at: null,
              otp_code: null,
              otp_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

          if (updateExistingErr) {
            throw new ValidationError('Failed to finalize activation');
          }

          // Ensure/activate profile
          try {
            const { data: existingProfile3 } = await supabase
              .from('user_profiles')
              .select('id, profile_status')
              .eq('user_id', user.id)
              .maybeSingle();
            if (existingProfile3) {
              if (existingProfile3.profile_status !== 'active') {
                await supabase
                  .from('user_profiles')
                  .update({ profile_status: 'active' })
                  .eq('id', existingProfile3.id);
              }
            } else {
              const admissionNumber3 = user.linked_admission_number || user.username || null;
              await supabase
                .from('user_profiles')
                .insert({ user_id: user.id, admission_number: admissionNumber3, profile_status: 'active', status: 'incomplete' });
            }
          } catch (e) {
            console.warn('Activation finalize (email exists) warning:', e.message);
          }

          return res.json({
            success: true,
            message: 'Account activated successfully. You can now log in.',
            data: { role: updatedUserExisting.role }
          });
        }
      } catch (linkErr) {
        console.error('❌ ACTIVATION: Failed to link existing auth user after email_exists:', linkErr);
      }
    }

    console.error('❌ ACTIVATION: Failed to create auth user:', authError);
    console.error('❌ ACTIVATION: User email:', user.email);
    console.error('❌ ACTIVATION: Auth error details:', {
      message: authError.message,
      status: authError.status,
      statusText: authError.statusText
    });
    throw new ValidationError('Failed to create authentication account');
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      auth_uid: authUser.user.id,
      status: 'active',
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
    console.error('❌ ACTIVATION: Failed to update user:', updateError);
    console.error('❌ ACTIVATION: User ID:', user.id);
    console.error('❌ ACTIVATION: Auth UID:', authUser.user.id);
    throw new ValidationError('Failed to finalize activation');
  }

  // Ensure/activate a corresponding user_profiles row for this user
  try {
    // Try to find an existing profile by users.id
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id, profile_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.profile_status !== 'active') {
        await supabase
          .from('user_profiles')
          .update({ profile_status: 'active' })
          .eq('id', existingProfile.id);
      }
    } else {
      // Create a minimal profile row to link the student immediately
      const admissionNumber = user.linked_admission_number || user.username || null;
      await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          admission_number: admissionNumber,
          profile_status: 'active',
          status: 'incomplete'
        });
    }
  } catch (e) {
    console.warn('Activation: unable to ensure/activate user profile:', e.message);
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
  let loginEmail = (email || '').trim();
  const rawIdentifier = loginEmail; // remember what user typed

  // Support username-based login (admission number / parent username) by resolving to email
  if (loginEmail && !loginEmail.includes('@')) {
    const usernameOrAdmission = loginEmail;

    let resolvedEmail = null;

    // 1) Exact username match (student or parent)
    const { data: byExactUsername } = await supabase
      .from('users')
      .select('email')
      .eq('username', usernameOrAdmission)
      .maybeSingle();
    resolvedEmail = byExactUsername?.email || resolvedEmail;

    // 2) Prefer a STUDENT mapped by linked_admission_number
    if (!resolvedEmail) {
      const { data: byStudentAdmission } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'student')
        .eq('linked_admission_number', usernameOrAdmission)
        .maybeSingle();
      resolvedEmail = byStudentAdmission?.email || resolvedEmail;
    }

    // 3) If still not found and the provided looks like an admission number, try parent username format PARENT-<admission>
    if (!resolvedEmail && !usernameOrAdmission.startsWith('PARENT-')) {
      const parentUsername = `PARENT-${usernameOrAdmission}`;
      const { data: byParentUsername } = await supabase
        .from('users')
        .select('email')
        .eq('username', parentUsername)
        .maybeSingle();
      resolvedEmail = byParentUsername?.email || resolvedEmail;
    }

    // 4) As a final fallback, map any user with linked_admission_number (parent or staff)
    if (!resolvedEmail) {
      const { data: byAnyAdmission } = await supabase
        .from('users')
        .select('email')
        .eq('linked_admission_number', usernameOrAdmission)
        .maybeSingle();
      resolvedEmail = byAnyAdmission?.email || resolvedEmail;
    }

    if (!resolvedEmail) {
      throw new AuthenticationError('Invalid email/username or password');
    }
    loginEmail = resolvedEmail;
  }

  try {
    console.log('🔍 LOGIN: Attempting login with email:', loginEmail);
    console.log('🔍 LOGIN: Raw identifier was:', rawIdentifier);
    
    // Authenticate user with Supabase (primary attempt)
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password
    });
    
    console.log('🔍 LOGIN: Primary auth attempt result:', { 
      success: !authError, 
      error: authError?.message,
      userId: authData?.user?.id 
    });

    // Fallback attempts when the user typed a username/admission number
    if (authError && rawIdentifier && !rawIdentifier.includes('@')) {
      console.log('🔍 LOGIN: Primary failed, trying fallback for:', rawIdentifier);
      const candidateEmails = new Set();
      // Collect possible emails for this admission number / username
      const { data: allCandidates } = await supabase
        .from('users')
        .select('email')
        .or(`username.eq.${rawIdentifier},linked_admission_number.eq.${rawIdentifier},username.eq.PARENT-${rawIdentifier}`);
      
      console.log('🔍 LOGIN: Found candidates:', allCandidates);
      (allCandidates || []).forEach(u => u?.email && candidateEmails.add(u.email));
      
      console.log('🔍 LOGIN: Trying fallback emails:', Array.from(candidateEmails));
      // Try each candidate until one succeeds
      for (const candidate of candidateEmails) {
        console.log('🔍 LOGIN: Trying candidate email:', candidate);
        const attempt = await supabase.auth.signInWithPassword({ email: candidate, password });
        console.log('🔍 LOGIN: Candidate result:', { 
          email: candidate, 
          success: !attempt.error, 
          error: attempt.error?.message 
        });
        if (!attempt.error) {
          authData = attempt.data;
          authError = null;
          console.log('🔍 LOGIN: Fallback succeeded!');
          break;
        }
      }
    }

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
          .update({ auth_uid: authData.user.id, status: byEmail.status || 'active' })
          .eq('id', byEmail.id)
          .select()
          .single();
        userProfile = linked || byEmail;
      }
    }

    // Check if user is suspended or inactive before proceeding
    if (userProfile && (userProfile.status === 'suspended' || userProfile.status === 'inactive')) {
      console.log('🔍 Auth: User status check failed:', {
        email: userProfile.email,
        role: userProfile.role,
        status: userProfile.status
      });
      const statusMessage = userProfile.status === 'suspended' 
        ? 'Your account has been suspended. Please contact an administrator.'
        : 'Your account is currently inactive. Please contact an administrator to activate your account.';
      throw new AuthenticationError(statusMessage);
    }

    // If user profile doesn't exist, this means the user wasn't created by staff
    // For our secure system, we don't allow automatic user creation
    if (!userProfile) {
      throw new AuthenticationError('Your account is not yet activated by hostel staff. Please contact the hostel administration.');
    }

  console.log('🔍 Auth: Login successful for user:', {
    email: userProfile.email,
    role: userProfile.role,
    status: userProfile.status,
    id: userProfile.id
  });

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
    console.log('🔍 AUTH/ME: Request from auth_uid:', req.user.id);
    console.log('🔍 AUTH/ME: Request email:', req.user.email);
    
    // First, get the user from users table
    let { data: userProfile, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', req.user.id)
      .single();
    
    console.log('🔍 AUTH/ME: User profile query result:', { userProfile, error });

    // If user doesn't exist, create it
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
        console.error('Profile creation details:', {
          auth_uid: req.user.id,
          email: req.user.email,
          full_name: req.user.user_metadata?.full_name || req.user.email.split('@')[0],
          phone: req.user.user_metadata?.phone || null,
          role: req.user.user_metadata?.role || 'student'
        });
        throw new AuthenticationError('Failed to create user profile');
      }

      userProfile = newProfile;
    }

    // Now get the user_profiles data separately (optional)
    const { data: userProfileDetails } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userProfile.id)
      .single();

    // Add user_profiles data to userProfile if it exists
    if (userProfileDetails) {
      userProfile.user_profiles = userProfileDetails;
    }

    console.log('🔍 AUTH/ME: Final user profile:', userProfile);
    console.log('🔍 AUTH/ME: User role:', userProfile.role);

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