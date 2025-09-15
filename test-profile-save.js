// Test script to verify profile saving works
require('dotenv').config({ path: './config.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testProfileSave() {
  console.log('Testing profile save with service role...');
  
  try {
    // Test data
    const testProfile = {
      user_id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
      admission_number: 'TEST123',
      course: 'Test Course',
      status: 'complete', // This should match the constraint
      profile_status: 'active' // This should match the constraint
    };

    // Try to insert/upsert
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(testProfile, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Profile save failed:', error);
    } else {
      console.log('Profile save successful:', data);
    }

    // Test users table update
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
        email: 'test@example.com',
        full_name: 'Test User',
        phone: '1234567890',
        role: 'student',
        password_hash: 'test-hash' // Required field
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (userError) {
      console.error('User save failed:', userError);
    } else {
      console.log('User save successful:', userData);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testProfileSave();
