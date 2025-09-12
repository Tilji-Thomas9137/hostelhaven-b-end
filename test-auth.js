const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in config.env');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testUserCreation() {
  try {
    console.log('🧪 Testing user creation with new schema...');
    
    // Test data
    const testUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      password_hash: 'oauth_user',
      full_name: 'Test User',
      phone: '+1234567890',
      role: 'student'
    };
    
    // Try to insert the test user
    const { data, error } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating test user:', error);
      return false;
    }
    
    console.log('✅ Test user created successfully:', data);
    
    // Clean up - delete the test user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', testUser.id);
    
    if (deleteError) {
      console.error('⚠️  Warning: Could not delete test user:', deleteError);
    } else {
      console.log('✅ Test user cleaned up successfully');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testSchema() {
  try {
    console.log('🔍 Testing database schema...');
    
    // Check if users table exists and has correct structure
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "users" does not exist')) {
        console.error('❌ Users table does not exist!');
        console.log('📋 Please run the minimal-schema.sql in your Supabase SQL editor first.');
        return false;
      } else {
        console.error('❌ Error checking users table:', error);
        return false;
      }
    }
    
    console.log('✅ Users table exists and is accessible');
    
    // Test user creation
    const userCreationTest = await testUserCreation();
    
    if (userCreationTest) {
      console.log('🎉 All tests passed! Your schema is ready for authentication.');
      return true;
    } else {
      console.log('❌ User creation test failed.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Schema test failed:', error.message);
    return false;
  }
}

// Run the test
testSchema().then(success => {
  if (success) {
    console.log('\n✅ Database schema is ready!');
    console.log('🚀 You can now test the authentication flow.');
  } else {
    console.log('\n❌ Database schema needs to be set up.');
    console.log('📋 Please run the minimal-schema.sql in your Supabase SQL editor.');
  }
  process.exit(success ? 0 : 1);
});
