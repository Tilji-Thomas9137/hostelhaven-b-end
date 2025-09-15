// Test the complete user-profiles API
require('dotenv').config({ path: './config.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompleteAPI() {
  console.log('Testing complete user-profiles API...');
  
  try {
    // Test data that includes both user_profiles and users fields
    const testProfileData = {
      // user_profiles fields
      admission_number: 'API123',
      course: 'API Test Course',
      batch_year: 2024,
      date_of_birth: '2000-01-01',
      gender: 'male',
      address: 'Test Address',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      emergency_contact_name: 'Emergency Contact',
      emergency_contact_phone: '9876543210',
      parent_name: 'Parent Name',
      parent_phone: '9876543211',
      parent_email: 'parent@test.com',
      aadhar_number: '123456789012',
      blood_group: 'O+',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg',
      aadhar_front_url: 'https://example.com/front.jpg',
      aadhar_back_url: 'https://example.com/back.jpg',
      pincode: '123456',
      status: 'complete',
      profile_status: 'active',
      
      // users fields
      full_name: 'Test User Full Name',
      phone: '1234567890',
      email: 'testuser@example.com'
    };

    // Test user_profiles table directly (only user_profiles fields)
    console.log('Testing user_profiles table...');
    const userProfilesFields = [
      'admission_number', 'course', 'batch_year', 'date_of_birth', 'gender',
      'address', 'city', 'state', 'country', 'emergency_contact_name',
      'emergency_contact_phone', 'parent_name', 'parent_phone', 'parent_email',
      'aadhar_number', 'blood_group', 'bio', 'avatar_url', 'aadhar_front_url', 
      'aadhar_back_url', 'pincode'
    ];

    const profileOnlyData = {};
    userProfilesFields.forEach(field => {
      if (testProfileData[field] !== undefined) {
        profileOnlyData[field] = testProfileData[field];
      }
    });

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        ...profileOnlyData,
        status: 'complete',
        profile_status: 'active'
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (profileError) {
      console.error('Profile save failed:', profileError);
    } else {
      console.log('Profile save successful');
    }

    // Test users table directly
    console.log('Testing users table...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'testuser@example.com',
        full_name: 'Test User Full Name',
        phone: '1234567890',
        role: 'student',
        password_hash: 'test-hash'
      }, { onConflict: 'id' })
      .select()
      .single();

    if (userError) {
      console.error('User save failed:', userError);
    } else {
      console.log('User save successful');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCompleteAPI();
