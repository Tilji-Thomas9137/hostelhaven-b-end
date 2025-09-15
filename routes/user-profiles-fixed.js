const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

// Create a service role client for bypassing RLS
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

/**
 * POST /api/user-profiles/save
 * Save user profile information
 */
router.post('/save', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profileData = req.body;

  console.log('Received profile data keys:', Object.keys(profileData));

  // Define EXACTLY what fields belong to user_profiles table
  const userProfilesFields = [
    'admission_number', 'course', 'batch_year', 'date_of_birth', 'gender',
    'address', 'city', 'state', 'country', 'emergency_contact_name',
    'emergency_contact_phone', 'parent_name', 'parent_phone', 'parent_email',
    'aadhar_number', 'blood_group', 'room_id', 'join_date', 'exit_date',
    'bio', 'avatar_url', 'aadhar_front_url', 'aadhar_back_url', 'pincode'
  ];

  // Define EXACTLY what fields belong to users table
  const usersFields = ['full_name', 'phone', 'email'];

  // Create safe profile data with ONLY user_profiles fields
  const safeProfileData = {
    user_id: userId,
    admission_number: profileData.admission_number || '',
    course: profileData.course || '',
    status: profileData.status || 'complete',
    profile_status: profileData.profile_status || 'active',
    updated_at: new Date().toISOString()
  };

  // Add only the allowed user_profiles fields
  userProfilesFields.forEach(field => {
    if (profileData[field] !== undefined && profileData[field] !== null) {
      safeProfileData[field] = profileData[field];
    }
  });

  // Create safe user data with ONLY users fields
  const safeUserData = {};
  usersFields.forEach(field => {
    if (profileData[field] !== undefined && profileData[field] !== null) {
      safeUserData[field] = profileData[field];
    }
  });

  console.log('Safe profile data keys:', Object.keys(safeProfileData));
  console.log('Safe user data keys:', Object.keys(safeUserData));

  try {
    // Use service role client to bypass RLS completely
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(safeProfileData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }

    // Also update the users table with basic info using service role
    if (Object.keys(safeUserData).length > 0) {
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          ...safeUserData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (userUpdateError) {
        console.warn('User table update failed:', userUpdateError);
        // Don't fail the entire operation if users table update fails
      }
    }

    res.json({
      success: true,
      message: 'Profile saved successfully',
      data: data
    });

  } catch (error) {
    console.error('Profile save error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save profile',
      error: error.message
    });
  }
}));

/**
 * GET /api/user-profiles/me
 * Get current user's profile
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      data: data || null
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
}));

module.exports = router;
