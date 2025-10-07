const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin/warden/assistant access
const staffMiddleware = async (req, res, next) => {
  try {
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden', 'hostel_operations_assistant'].includes(userProfile.role)) {
      throw new AuthorizationError('Staff access required');
    }
    
    // Set the database ID for use in route handlers
    req.user.dbId = userProfile.id;
    
    next();
  } catch (error) {
    throw new AuthorizationError('Staff access required');
  }
};

/**
 * @route   GET /api/admission-registry/students
 * @desc    Get all students in admission registry
 * @access  Private (Staff)
 */
router.get('/students', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('admission_registry')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`admission_number.ilike.%${search}%,student_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: students, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('admission_registry')
      .select('*', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (search) {
      countQuery = countQuery.or(`admission_number.ilike.%${search}%,student_name.ilike.%${search}%`);
    }

    const { count } = await countQuery;

    res.json({
      success: true,
      data: { 
        students: students || [],
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
 * @route   POST /api/admission-registry/students
 * @desc    Add new student to admission registry
 * @access  Private (Staff)
 */
router.post('/students', authMiddleware, staffMiddleware, [
  body('admission_number').notEmpty().withMessage('Admission number is required'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('course').notEmpty().withMessage('Course is required'),
  body('year').isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),
  body('parent_name').notEmpty().withMessage('Parent name is required'),
  body('parent_phone').notEmpty().withMessage('Parent phone is required'),
  body('parent_email').isEmail().withMessage('Valid parent email is required'),
  body('student_email').isEmail().withMessage('Student email is required'),
  body('student_phone').notEmpty().withMessage('Student phone is required'),
  body('parent_relation').notEmpty().withMessage('Parent relation is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const {
    admission_number,
    full_name,
    course,
    year,
    parent_name,
    parent_phone,
    parent_email,
    student_email,
    parent_relation,
    student_phone
  } = req.body;

  try {
    // Check if admission number already exists
    const { data: existingAdmission } = await supabaseAdmin
      .from('admission_registry')
      .select('admission_number')
      .eq('admission_number', admission_number)
      .single();

    if (existingAdmission) {
      throw new ValidationError('Student with this admission number already exists');
    }

    // Check if student email already exists in users table
    const { data: existingStudentEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', student_email)
      .single();

    if (existingStudentEmail) {
      throw new ValidationError('Student with this email already exists');
    }

    // Check if parent email already exists in users table
    const { data: existingParentEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', parent_email)
      .single();

    if (existingParentEmail) {
      throw new ValidationError('Parent with this email already exists');
    }

    // Prepare activation token + OTP instead of creating an auth user now
    const { generateActivationToken, generateOtpCode, getExpiryFromNowMinutes, getExpiryFromNowHours } = require('../utils/security');
    const { sendActivationEmailHybrid } = require('../utils/hybrid-mailer');

    // Ensure parent and student emails are not identical
    if (parent_email && student_email && parent_email.toLowerCase() === student_email.toLowerCase()) {
      throw new ValidationError('Parent email must be different from student email');
    }

    // Student activation bundle
    const student_activation_token = generateActivationToken();
    const student_activation_expires_at = getExpiryFromNowHours(24);
    const student_otp_code = generateOtpCode();
    const student_otp_expires_at = getExpiryFromNowMinutes(10);

    // Parent activation bundle
    const parent_activation_token = generateActivationToken();
    const parent_activation_expires_at = getExpiryFromNowHours(24);
    const parent_otp_code = generateOtpCode();
    const parent_otp_expires_at = getExpiryFromNowMinutes(10);

    // Create user entry in users table (pending activation)
    // Student email required
    const accountEmail = student_email;

    const { data: newStudentUser, error: studentUserError } = await supabaseAdmin
      .from('users')
      .insert({
        email: accountEmail,
        full_name: full_name,
        phone: student_phone,
        role: 'student',
        username: admission_number,
        linked_admission_number: admission_number,
        status: 'inactive',
        // Placeholder hash to satisfy NOT NULL until activation sets real password
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        activation_token: student_activation_token,
        activation_expires_at: student_activation_expires_at,
        otp_code: student_otp_code,
        otp_expires_at: student_otp_expires_at
      })
      .select()
      .single();

    if (studentUserError) {
      throw new Error(`Failed to create student user: ${studentUserError.message}`);
    }

    // Create or refresh parent user account with standardized username
    const parentUsername = `PARENT-${String(admission_number)}`;

    // Check if parent email already exists
    const { data: existingParent } = await supabaseAdmin
      .from('users')
      .select('id, role, linked_admission_number, username')
      .eq('email', parent_email)
      .single();

    // Check if parent username already exists (to avoid conflicts)
    const { data: existingUsername } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('username', parentUsername)
      .single();

    let newParentUser;
    let finalParentUsername = parentUsername;
    
    // If username already exists, generate a unique one
    if (existingUsername) {
      let counter = 1;
      do {
        finalParentUsername = `PARENT-${String(admission_number)}-${counter}`;
        const { data: checkUsername } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('username', finalParentUsername)
          .single();
        if (!checkUsername) break;
        counter++;
      } while (counter < 100); // Prevent infinite loop
    }

    if (existingParent) {
      if (existingParent.role === 'parent' && existingParent.linked_admission_number === admission_number) {
        const { data: refreshed, error: refreshErr } = await supabaseAdmin
          .from('users')
          .update({
            username: finalParentUsername,
            status: 'inactive',
            activation_token: parent_activation_token,
            activation_expires_at: parent_activation_expires_at,
            otp_code: parent_otp_code,
            otp_expires_at: parent_otp_expires_at
          })
          .eq('id', existingParent.id)
          .select()
          .single();
        if (refreshErr) {
          await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
          throw new Error(`Failed to refresh parent activation: ${refreshErr.message}`);
        }
        newParentUser = refreshed;
      } else {
        await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
        throw new ValidationError('Parent email is already in use by another account');
      }
    } else {
      const { data: createdParent, error: parentUserError } = await supabaseAdmin
        .from('users')
        .insert({
          email: parent_email,
          full_name: parent_name,
          phone: parent_phone,
          role: 'parent',
          username: finalParentUsername,
          linked_admission_number: admission_number,
          status: 'inactive',
          password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
          activation_token: parent_activation_token,
          activation_expires_at: parent_activation_expires_at,
          otp_code: parent_otp_code,
          otp_expires_at: parent_otp_expires_at
        })
        .select()
        .single();

      if (parentUserError) {
        await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
        throw new Error(`Failed to create parent user: ${parentUserError.message}`);
      }
      newParentUser = createdParent;
    }

    // Create admission registry entry FIRST (required for foreign key constraint)
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from('admission_registry')
      .insert({
        admission_number,
        student_name: full_name,
        course,
        batch_year: parseInt(year),
        student_email,
        student_phone,
        parent_name,
        parent_email,
        parent_phone,
        added_by: req.user.dbId || null  // Use database ID, not auth UUID
      })
      .select()
      .single();

    if (studentError) {
      // Clean up created users if admission registry creation fails
      await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
      await supabaseAdmin.from('users').delete().eq('id', newParentUser.id);
      throw new Error(`Failed to create student record: ${studentError.message}`);
    }

    // Now create user_profiles record (after admission_registry exists)
    let studentProfile;
    try {
      const profileData = {
        user_id: newStudentUser.id,
        admission_number: admission_number,
        course: course,
        batch_year: parseInt(year),
        parent_name: parent_name,
        parent_phone: parent_phone,
        parent_email: parent_email,
        status: 'incomplete', // Student needs to complete their profile
        profile_status: 'active',
        join_date: new Date().toISOString().split('T')[0] // Set current date as join date
        // Other fields like date_of_birth, gender, address, etc. will be filled by student
      };
      
      console.log('Creating user profile with data:', profileData);
      
      // Try to insert user profile
      let { data: newStudentProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();
      
      // If RLS is blocking the insertion, try to add service role bypass policy
      if (profileError && profileError.message.includes('policy')) {
        console.log('RLS policy blocking insertion, attempting to add service role bypass...');
        try {
          await supabaseAdmin.rpc('exec_sql', {
            sql: `
              CREATE POLICY IF NOT EXISTS "service_role_bypass_user_profiles" ON user_profiles
                  FOR ALL USING (auth.role() = 'service_role');
            `
          });
          
          // Retry insertion
          const retryResult = await supabaseAdmin
            .from('user_profiles')
            .insert(profileData)
            .select()
            .single();
          
          newStudentProfile = retryResult.data;
          profileError = retryResult.error;
        } catch (rlsFixError) {
          console.error('Failed to fix RLS policy:', rlsFixError.message);
        }
      }

      if (profileError) {
        console.error('User profile creation failed:', profileError);
        await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
        await supabaseAdmin.from('users').delete().eq('id', newParentUser.id);
        await supabaseAdmin.from('admission_registry').delete().eq('admission_number', admission_number);
        throw new Error(`Failed to create student profile: ${profileError.message}`);
      }
      studentProfile = newStudentProfile;
    } catch (profileErr) {
      // Rollback created users and admission registry if we cannot persist student profile
      await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
      await supabaseAdmin.from('users').delete().eq('id', newParentUser.id);
      await supabaseAdmin.from('admission_registry').delete().eq('admission_number', admission_number);
      throw new Error(`Failed to create student profile: ${profileErr.message}`);
    }

      // Ensure a corresponding record exists in the parents table
      try {
        const { data: existingParentRow } = await supabaseAdmin
          .from('parents')
          .select('id')
          .eq('user_id', newParentUser.id)
          .single();

        if (existingParentRow) {
          await supabaseAdmin
            .from('parents')
            .update({
              student_profile_id: studentProfile.id,
              email: parent_email,
              phone: parent_phone,
              verified: true, // Auto-verify parents created by admin
              otp_code: parent_otp_code,
              otp_expires_at: parent_otp_expires_at
            })
            .eq('id', existingParentRow.id);
        } else {
          await supabaseAdmin
            .from('parents')
            .insert({
              user_id: newParentUser.id,
              student_profile_id: studentProfile.id,
              email: parent_email,
              phone: parent_phone,
              verified: true, // Auto-verify parents created by admin
              otp_code: parent_otp_code,
              otp_expires_at: parent_otp_expires_at
            });
        }
    } catch (parentTblErr) {
      // Rollback created users and profile if we cannot persist parent info
      await supabaseAdmin.from('user_profiles').delete().eq('id', studentProfile.id);
      await supabaseAdmin.from('users').delete().eq('id', newStudentUser.id);
      await supabaseAdmin.from('users').delete().eq('id', newParentUser.id);
      throw new Error(`Failed to upsert into parents table: ${parentTblErr.message}`);
    }

    // Admission registry entry already created above

    // Send our custom activation email to student (with username and token link)
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=${student_activation_token}`;
      console.log(`📧 Sending activation email to student: ${accountEmail}`);
      await sendActivationEmailHybrid({
        to: accountEmail,
        fullName: full_name,
        username: admission_number,
        activationLink,
        otpCode: student_otp_code
      });
      console.log(`✅ Student activation email sent successfully to ${accountEmail}`);
    } catch (mailError) {
      console.error('❌ Failed to send student activation email:', mailError.message);
      console.error('Email configuration check:');
      console.error(`  SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
      console.error(`  SMTP_USER: ${process.env.SMTP_USER || 'NOT SET'}`);
      console.error(`  SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
    }

    // Also trigger Supabase invite to fire the Auth Hook (for new users)
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectTo = `${frontendUrl}/auth/callback`;
      await supabaseAdmin.auth.admin.inviteUserByEmail(accountEmail, { redirectTo });
    } catch (inviteError) {
      console.warn('Supabase invite failed (hook may still work):', inviteError.message);
    }

    // Send our custom activation email to parent (with username and token link)
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=${parent_activation_token}`;
      console.log(`📧 Sending activation email to parent: ${parent_email}`);
      await sendActivationEmailHybrid({
        to: parent_email,
        fullName: parent_name,
        username: finalParentUsername,
        activationLink,
        otpCode: parent_otp_code
      });
      console.log(`✅ Parent activation email sent successfully to ${parent_email}`);
    } catch (mailError) {
      console.error('❌ Failed to send parent activation email:', mailError.message);
    }

    // Also trigger Supabase invite for parent to fire the Auth Hook
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectTo = `${frontendUrl}/auth/callback`;
      await supabaseAdmin.auth.admin.inviteUserByEmail(parent_email, { redirectTo });
    } catch (inviteError) {
      console.warn('Supabase parent invite failed (hook may still work):', inviteError.message);
    }

    // Send activation via WhatsApp to student
    try {
      const { sendActivationWhatsApp } = require('../utils/whatsapp');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=${student_activation_token}`;
      console.log(`📱 Sending WhatsApp notification to student: ${student_phone}`);
      await sendActivationWhatsApp({
        to: student_phone,
        username: admission_number,
        activationLink,
        otpCode: student_otp_code
      });
      console.log(`✅ WhatsApp notification sent successfully to ${student_phone}`);
    } catch (waError) {
      console.error('❌ Failed to send WhatsApp notification:', waError.message);
      console.error('WhatsApp configuration check:');
      console.error(`  WHATSAPP_TOKEN: ${process.env.WHATSAPP_TOKEN ? 'SET' : 'NOT SET'}`);
      console.error(`  WHATSAPP_PHONE_NUMBER_ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || 'NOT SET'}`);
    }

    res.status(201).json({
      success: true,
      data: { 
        student: newStudent,
        users: { student: newStudentUser, parent: newParentUser }
      },
      message: 'Student and parent users created. Activation emails sent with OTP.'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   PUT /api/admission-registry/students/:admission_number
 * @desc    Update student in admission registry
 * @access  Private (Staff)
 */
router.put('/students/:admission_number', authMiddleware, staffMiddleware, [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('course').optional().notEmpty().withMessage('Course cannot be empty'),
  body('year').optional().isInt({ min: 1, max: 4 }).withMessage('Year must be between 1 and 4'),
  body('parent_name').optional().notEmpty().withMessage('Parent name cannot be empty'),
  body('parent_phone').optional().notEmpty().withMessage('Parent phone cannot be empty'),
  body('parent_email').optional().isEmail().withMessage('Valid parent email is required'),
  body('parent_relation').optional().notEmpty().withMessage('Parent relation cannot be empty'),
  body('student_email').optional().isEmail().withMessage('Valid student email is required'),
  body('student_phone').optional().notEmpty().withMessage('Student phone cannot be empty')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { admission_number } = req.params;
  const { full_name, course, year, parent_name, parent_phone, parent_email, parent_relation, student_email, student_phone } = req.body;

  try {
    // Check if student exists
    const { data: existingStudent, error: fetchError } = await supabaseAdmin
      .from('admission_registry')
      .select('admission_number')
      .eq('admission_number', admission_number)
      .single();

    if (fetchError || !existingStudent) {
      throw new ValidationError('Student not found');
    }

    // Prepare update data (only include fields that exist in the schema)
    const updateData = {};
    if (full_name) updateData.student_name = full_name;
    if (course) updateData.course = course;
    if (year) updateData.batch_year = parseInt(year);
    if (parent_name) updateData.parent_name = parent_name;
    if (parent_phone) updateData.parent_phone = parent_phone;
    if (parent_email) updateData.parent_email = parent_email;
    if (student_email) updateData.student_email = student_email;
    if (student_phone) updateData.student_phone = student_phone;

    // Update student record using service role to bypass RLS
    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from('admission_registry')
      .update(updateData)
      .eq('admission_number', admission_number)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update student: ${updateError.message}`);
    }

    // Also update the corresponding user_profiles record (admin-managed fields only)
    const profileUpdateData = {};
    if (course) profileUpdateData.course = course;
    if (year) profileUpdateData.batch_year = parseInt(year);
    if (parent_name) profileUpdateData.parent_name = parent_name;
    if (parent_phone) profileUpdateData.parent_phone = parent_phone;
    if (parent_email) profileUpdateData.parent_email = parent_email;
    // Note: full_name, emergency_contact_*, and other student fields are managed by student

    // Update user_profiles if there are changes
    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update(profileUpdateData)
        .eq('admission_number', admission_number);

      if (profileUpdateError) {
        console.warn('Failed to update user profile:', profileUpdateError.message);
        // Don't throw error here as admission_registry was updated successfully
      }
    }

    res.json({
      success: true,
      data: { 
        student: updatedStudent
      },
      message: 'Student updated successfully'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   DELETE /api/admission-registry/students/:admission_number
 * @desc    Delete student from admission registry
 * @access  Private (Staff)
 */
router.delete('/students/:admission_number', authMiddleware, staffMiddleware, asyncHandler(async (req, res) => {
  const { admission_number } = req.params;

  try {
    // Check if student exists and get associated user info
    const { data: existingStudent, error: fetchError } = await supabaseAdmin
      .from('admission_registry')
      .select('admission_number, student_email')
      .eq('admission_number', admission_number)
      .single();

    if (fetchError || !existingStudent) {
      throw new ValidationError('Student not found');
    }

    // Find associated user accounts (both student and parent)
    const { data: studentUser, error: studentUserError } = await supabaseAdmin
      .from('users')
      .select('id, auth_uid, email')
      .eq('email', existingStudent.student_email)
      .single();

    // Find parent user account
    const { data: parentUser, error: parentUserError } = await supabaseAdmin
      .from('users')
      .select('id, auth_uid, email')
      .eq('linked_admission_number', admission_number)
      .eq('role', 'parent')
      .single();

    // Step 1: Delete ALL user_profiles that reference this admission_number
    // This includes both student and parent profiles
    const { error: allProfilesDeleteError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('admission_number', admission_number);

    if (allProfilesDeleteError) {
      console.warn(`Failed to delete user profiles for admission ${admission_number}: ${allProfilesDeleteError.message}`);
    } else {
      console.log(`Deleted user profiles for admission ${admission_number}`);
    }

    // Also delete any profiles by user_id (backup method)
    if (studentUser && !studentUserError) {
      const { error: profileDeleteError } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('user_id', studentUser.id);

      if (profileDeleteError) {
        console.warn(`Failed to delete student profile: ${profileDeleteError.message}`);
      }
    }

    if (parentUser && !parentUserError) {
      const { error: parentProfileDeleteError } = await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('user_id', parentUser.id);

      if (parentProfileDeleteError) {
        console.warn(`Failed to delete parent profile: ${parentProfileDeleteError.message}`);
      }
    }

    // Step 2: Delete from users table
    if (studentUser && !studentUserError) {
      const { error: studentUserDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', studentUser.id);

      if (studentUserDeleteError) {
        console.warn(`Failed to delete student user: ${studentUserDeleteError.message}`);
      }

      // Delete from Supabase Auth
      if (studentUser.auth_uid) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(studentUser.auth_uid);
        } catch (authDeleteError) {
          console.warn(`Failed to delete student auth user ${studentUser.auth_uid}:`, authDeleteError.message);
        }
      }
    }

    if (parentUser && !parentUserError) {
      const { error: parentUserDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', parentUser.id);

      if (parentUserDeleteError) {
        console.warn(`Failed to delete parent user: ${parentUserDeleteError.message}`);
      }

      // Delete from Supabase Auth
      if (parentUser.auth_uid) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(parentUser.auth_uid);
        } catch (authDeleteError) {
          console.warn(`Failed to delete parent auth user ${parentUser.auth_uid}:`, authDeleteError.message);
        }
      }
    }

    // Step 3: Finally delete from admission_registry (now safe from foreign key constraints)
    const { error: deleteError } = await supabaseAdmin
      .from('admission_registry')
      .delete()
      .eq('admission_number', admission_number);

    if (deleteError) {
      throw new Error(`Failed to delete student: ${deleteError.message}`);
    }

    res.json({
      success: true,
      message: 'Student and all associated records deleted successfully'
    });
  } catch (error) {
    throw error;
  }
}));

/**
 * @route   POST /api/admission-registry/students/:id/activate
 * @desc    Activate student (create user profile and auth account)
 * @access  Private (Admin/Warden only)
 */
router.post('/students/:id/activate', authMiddleware, async (req, res, next) => {
  try {
    // Check if user has admin or warden role
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('role')
      .eq('auth_uid', req.user.id)
      .single();

    if (error || !userProfile || !['admin', 'warden'].includes(userProfile.role)) {
      throw new AuthorizationError('Admin or Warden access required');
    }

    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    // Get student details
    const { data: student, error: fetchError } = await supabase
      .from('admission_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !student) {
      throw new ValidationError('Student not found');
    }

    if (student.status !== 'approved') {
      throw new ValidationError('Student must be approved before activation');
    }

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('admission_number', student.admission_number)
      .single();

    if (existingProfile) {
      throw new ValidationError('Student is already activated');
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: student.email,
      password,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // Create user profile
    const { data: newUserProfile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        auth_uid: authUser.user.id,
        admission_number: student.admission_number,
        full_name: student.full_name,
        email: student.email,
        phone: student.phone,
        course: student.course,
        year: student.year,
        status: 'active'
      })
      .select()
      .single();

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    // Update admission registry status
    await supabase
      .from('admission_registry')
      .update({ status: 'active' })
      .eq('id', id);

    res.json({
      success: true,
      data: { 
        user: newUserProfile,
        message: 'Student activated successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
