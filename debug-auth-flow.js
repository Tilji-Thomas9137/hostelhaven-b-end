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

async function debugAuthFlow() {
  console.log('🔍 Debugging authentication flow...');
  
  try {
    // Step 1: Find the student by email
    console.log('\n📋 Step 1: Finding student by email...');
    const { data: student, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'aswinmurali2026@mca.ajce.in')
      .single();

    if (fetchError || !student) {
      console.error('❌ Student not found:', fetchError);
      return;
    }

    console.log('✅ Student found:', {
      id: student.id,
      email: student.email,
      full_name: student.full_name,
      role: student.role,
      status: student.status,
      auth_uid: student.auth_uid
    });

    // Step 2: Check user_profiles table using auth_uid (as the middleware does)
    console.log('\n📋 Step 2: Checking user_profiles with auth_uid...');
    const { data: userProfileByAuthUid, error: profileError1 } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', student.auth_uid)
      .single();

    console.log('Profile by auth_uid result:', {
      found: !!userProfileByAuthUid,
      error: profileError1?.message,
      profile: userProfileByAuthUid ? {
        id: userProfileByAuthUid.id,
        user_id: userProfileByAuthUid.user_id,
        admission_number: userProfileByAuthUid.admission_number,
        profile_status: userProfileByAuthUid.profile_status,
        status: userProfileByAuthUid.status
      } : null
    });

    // Step 3: Check user_profiles table using users.id (as it should be)
    console.log('\n📋 Step 3: Checking user_profiles with users.id...');
    const { data: userProfileById, error: profileError2 } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', student.id)
      .single();

    console.log('Profile by users.id result:', {
      found: !!userProfileById,
      error: profileError2?.message,
      profile: userProfileById ? {
        id: userProfileById.id,
        user_id: userProfileById.user_id,
        admission_number: userProfileById.admission_number,
        profile_status: userProfileById.profile_status,
        status: userProfileById.status
      } : null
    });

    // Step 4: Check what the auth middleware is actually doing
    console.log('\n📋 Step 4: Simulating auth middleware logic...');
    
    // First, get user profile by auth_uid (this is what the middleware does first)
    const { data: middlewareUserProfile, error: middlewareError1 } = await supabase
      .from('users')
      .select('status, role')
      .eq('auth_uid', student.auth_uid)
      .single();

    console.log('Middleware user profile lookup:', {
      found: !!middlewareUserProfile,
      error: middlewareError1?.message,
      profile: middlewareUserProfile
    });

    if (middlewareUserProfile?.role === 'student') {
      // This is where the middleware checks user_profiles
      const { data: studentProfile, error: studentError } = await supabase
        .from('user_profiles')
        .select('admission_number, profile_status, status')
        .eq('user_id', middlewareUserProfile.id) // This is the problem!
        .single();

      console.log('Student profile check (using middlewareUserProfile.id):', {
        found: !!studentProfile,
        error: studentError?.message,
        profile: studentProfile
      });

      if (studentError || !studentProfile || studentProfile.profile_status !== 'active') {
        console.log('❌ AUTH WOULD FAIL: Student profile check failed');
        console.log('   - Error:', studentError?.message);
        console.log('   - Profile found:', !!studentProfile);
        console.log('   - Profile status:', studentProfile?.profile_status);
      } else {
        console.log('✅ AUTH WOULD PASS: Student profile check passed');
      }
    }

    // Step 5: Fix the issue
    console.log('\n🔧 Step 5: Fixing the auth middleware logic...');
    
    // The correct way should be to use the users.id, not middlewareUserProfile.id
    const { data: correctStudentProfile, error: correctError } = await supabase
      .from('user_profiles')
      .select('admission_number, profile_status, status')
      .eq('user_id', student.id) // Use the users table id
      .single();

    console.log('Correct student profile check (using student.id):', {
      found: !!correctStudentProfile,
      error: correctError?.message,
      profile: correctStudentProfile
    });

    if (correctStudentProfile && correctStudentProfile.profile_status === 'active') {
      console.log('✅ CORRECT AUTH WOULD PASS: Using student.id works!');
    }

  } catch (error) {
    console.error('❌ Error in debug:', error);
  }
}

debugAuthFlow();

