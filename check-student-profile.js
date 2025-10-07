const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStudentProfile() {
  console.log('🔍 Checking student profile...');
  
  try {
    // Find the student by email
    const { data: student, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'aswinmurali2026@mca.ajce.in')
      .single();

    if (fetchError || !student) {
      console.error('❌ Student not found:', fetchError);
      return;
    }

    console.log('📋 Student in users table:', {
      id: student.id,
      email: student.email,
      full_name: student.full_name,
      role: student.role,
      status: student.status,
      auth_uid: student.auth_uid
    });

    // Check user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', student.id)
      .single();

    if (profileError) {
      console.log('❌ No user profile found:', profileError.message);
      
      // Check if there's an existing profile with a different admission number
      console.log('🔍 Checking for existing profiles...');
      const { data: existingProfiles, error: listError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(10);

      if (listError) {
        console.error('❌ Failed to list profiles:', listError);
        return;
      }

      console.log('📋 Existing profiles:', existingProfiles?.map(p => ({
        id: p.id,
        user_id: p.user_id,
        admission_number: p.admission_number
      })));

      // Create the missing user profile with correct schema
      console.log('🔧 Creating user profile...');
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: student.id, // Use the users table id, not auth_uid
          admission_number: `STUDENT-${Date.now()}`, // Generate unique admission number
          course: 'Computer Science',
          batch_year: 2024,
          profile_status: 'active',
          status: 'complete'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create user profile:', createError);
        return;
      }

      console.log('✅ User profile created:', newProfile);
    } else {
      console.log('📋 User profile found:', {
        id: userProfile.id,
        user_id: userProfile.user_id,
        admission_number: userProfile.admission_number,
        profile_status: userProfile.profile_status,
        status: userProfile.status
      });

      // Update the profile if needed
      if (userProfile.profile_status !== 'active' || userProfile.status !== 'complete') {
        console.log('🔧 Updating user profile to active...');
        const { data: updatedProfile, error: updateError } = await supabase
          .from('user_profiles')
          .update({
            profile_status: 'active',
            status: 'complete'
          })
          .eq('id', userProfile.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Failed to update user profile:', updateError);
          return;
        }

        console.log('✅ User profile updated:', updatedProfile);
      }
    }

  } catch (error) {
    console.error('❌ Error checking student profile:', error);
  }
}

checkStudentProfile();
