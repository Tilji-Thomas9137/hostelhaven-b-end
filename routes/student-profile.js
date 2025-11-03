const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/student-profile
 * @desc    Get student profile from admission registry
 * @access  Private (Student only)
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Student profile API called by user:', {
      email: req.user.email,
      auth_uid: req.user.id
    });

    // First, ensure the user exists in the users table
    console.log('🔍 Checking if user exists in users table:', req.user.id);
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, auth_uid')
      .eq('auth_uid', req.user.id)
      .single();

    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist, create them first
      console.log('👤 User not found in users table, creating user record...');
      const { data: newUser, error: createUserError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_uid: req.user.id,
          email: req.user.email || '',
          full_name: req.user.user_metadata?.full_name || 'Student',
          role: 'student',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createUserError) {
        console.error('❌ Failed to create user:', createUserError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user record'
        });
      }
      console.log('✅ User created successfully:', newUser.id);
    } else if (userCheckError) {
      console.error('❌ Error checking user existence:', userCheckError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check user existence'
      });
    } else {
      console.log('✅ User exists in users table:', existingUser.id);
    }
    
    // Query user_profiles table using service role (bypasses RLS)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        *,
        users!inner(
          id,
          email,
          full_name,
          role,
          phone,
          room_id,
          status,
          auth_uid,
          created_at,
          updated_at
        )
      `)
      // Match by auth_uid
      .eq('users.auth_uid', req.user.id)
      .maybeSingle();
    
    // Also fetch admission registry data for admission_number and course
    const { data: admissionData, error: admissionError } = await supabaseAdmin
      .from('admission_registry')
      .select('*')
      .eq('user_id', profileData?.users?.id)
      .maybeSingle();
    
    if (admissionError) {
      console.error('Error fetching admission registry data:', admissionError);
      // Don't fail the request, just log the error
    }
    
    if (profileError) {
      console.error('Error fetching student profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch student profile'
      });
    }
    
    if (!profileData) {
      console.log('❌ No profile found for user by auth_uid');
      return res.status(404).json({
        success: false,
        error: 'Student profile not found'
      });
    }
    
    console.log('✅ Profile found for user. Profile ID:', profileData.id);
    
    // Transform the data to match frontend expectations
    const transformedData = {
      id: profileData.id,
      // Use admission_registry data if available, fallback to user_profiles data
      admission_number: admissionData?.admission_number || profileData.admission_number,
      course: admissionData?.course || profileData.course,
      batch_year: profileData.batch_year,
      date_of_birth: profileData.date_of_birth,
      address: profileData.address,
      gender: profileData.gender,
      city: profileData.city,
      state: profileData.state,
      country: profileData.country,
      emergency_contact_name: profileData.emergency_contact_name,
      emergency_contact_phone: profileData.emergency_contact_phone,
      parent_name: profileData.parent_name,
      parent_phone: profileData.parent_phone,
      parent_email: profileData.parent_email,
      aadhar_number: profileData.aadhar_number,
      blood_group: profileData.blood_group,
      join_date: profileData.join_date,
      profile_status: profileData.profile_status,
      status: profileData.status,
      bio: profileData.bio,
      avatar_url: profileData.avatar_url,
      pincode: profileData.pincode,
      admission_number_verified: profileData.admission_number_verified,
      parent_contact_locked: profileData.parent_contact_locked,
      // Include user data
      user: {
        id: profileData.users.id,
        email: profileData.users.email,
        full_name: profileData.users.full_name,
        role: profileData.users.role,
        phone: profileData.users.phone,
        room_id: profileData.users.room_id,
        status: profileData.users.status,
        auth_uid: profileData.users.auth_uid,
        created_at: profileData.users.created_at,
        updated_at: profileData.users.updated_at
      },
      // Include admission registry data for additional fields
      admission_registry: admissionData ? {
        admission_number: admissionData.admission_number,
        course: admissionData.course,
        year: admissionData.year,
        student_name: admissionData.student_name,
        student_email: admissionData.student_email,
        parent_name: admissionData.parent_name,
        parent_email: admissionData.parent_email,
        parent_phone: admissionData.parent_phone,
        status: admissionData.status
      } : null
    };

    res.json({
      success: true,
      data: transformedData
    });
    
  } catch (error) {
    console.error('Error in student profile endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}));

module.exports = router;
