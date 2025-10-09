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
      // Prefer matching by auth_uid to avoid email mismatches
      .eq('users.auth_uid', req.user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('Error fetching student profile:', profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch student profile'
      });
    }
    
    if (!profileData) {
      console.log('❌ No profile found for user by auth_uid, falling back to email match (if available)');
      // Fallback to email match in case auth_uid isn't populated yet
      if (req.user.email) {
        const { data: byEmail } = await supabaseAdmin
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
          .eq('users.email', req.user.email)
          .maybeSingle();

        if (byEmail) {
          return res.json({ success: true, data: {
            id: byEmail.id,
            admission_number: byEmail.admission_number,
            course: byEmail.course,
            batch_year: byEmail.batch_year,
            date_of_birth: byEmail.date_of_birth,
            address: byEmail.address,
            city: byEmail.city,
            state: byEmail.state,
            country: byEmail.country,
            emergency_contact_name: byEmail.emergency_contact_name,
            emergency_contact_phone: byEmail.emergency_contact_phone,
            parent_name: byEmail.parent_name,
            parent_phone: byEmail.parent_phone,
            parent_email: byEmail.parent_email,
            aadhar_number: byEmail.aadhar_number,
            blood_group: byEmail.blood_group,
            join_date: byEmail.join_date,
            profile_status: byEmail.profile_status,
            status: byEmail.status,
            bio: byEmail.bio,
            avatar_url: byEmail.avatar_url,
            pincode: byEmail.pincode,
            admission_number_verified: byEmail.admission_number_verified,
            parent_contact_locked: byEmail.parent_contact_locked,
            user: {
              id: byEmail.users.id,
              email: byEmail.users.email,
              full_name: byEmail.users.full_name,
              role: byEmail.users.role,
              phone: byEmail.users.phone,
              room_id: byEmail.users.room_id,
              status: byEmail.users.status,
              auth_uid: byEmail.users.auth_uid,
              created_at: byEmail.users.created_at,
              updated_at: byEmail.users.updated_at
            }
          }});
        }
      }
      
      return res.status(404).json({
        success: false,
        error: 'Student profile not found'
      });
    }
    
    console.log('✅ Profile found for user. Profile ID:', profileData.id);
    
    // Transform the data to match frontend expectations
    const transformedData = {
      id: profileData.id,
      admission_number: profileData.admission_number,
      course: profileData.course,
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
      }
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
