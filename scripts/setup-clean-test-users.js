#!/usr/bin/env node

/**
 * Setup Clean Test Users for HostelHaven
 * Creates authentication accounts for minimal test users
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Clean test user credentials
const cleanTestUsers = [
  {
    email: 'admin@test.com',
    password: 'Test123!',
    fullName: 'Test Admin',
    role: 'admin',
    authUid: 'admin-auth-1111-1111-1111-111111111111'
  },
  {
    email: 'warden@test.com',
    password: 'Test123!',
    fullName: 'Test Warden',
    role: 'warden',
    authUid: 'warden-auth-2222-2222-2222-222222222222'
  },
  {
    email: 'ops@test.com',
    password: 'Test123!',
    fullName: 'Test Operations',
    role: 'hostel_operations_assistant',
    authUid: 'ops-auth-3333-3333-3333-333333333333'
  },
  {
    email: 'student@test.com',
    password: 'Test123!',
    fullName: 'Test Student',
    role: 'student',
    authUid: 'student-auth-4444-4444-4444-444444444444'
  },
  {
    email: 'parent@test.com',
    password: 'Test123!',
    fullName: 'Test Parent',
    role: 'parent',
    authUid: 'parent-auth-5555-5555-5555-555555555555'
  }
];

/**
 * Create a user in Supabase Auth
 */
async function createAuthUser(user) {
  try {
    console.log(`🔐 Creating auth user: ${user.email}`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        role: user.role
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`   ⚠️  User already exists: ${user.email}`);
        return { success: false, exists: true, error: null };
      }
      throw error;
    }

    console.log(`   ✅ Created successfully: ${user.email} (ID: ${data.user.id})`);
    return { success: true, exists: false, userId: data.user.id, error: null };

  } catch (error) {
    console.error(`   ❌ Failed to create ${user.email}:`, error.message);
    return { success: false, exists: false, error: error.message };
  }
}

/**
 * Update user auth_uid in our database
 */
async function updateUserAuthUid(email, authUid) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ auth_uid: authUid })
      .eq('email', email);

    if (error) {
      console.error(`   ❌ Failed to update auth_uid for ${email}:`, error.message);
      return false;
    }

    console.log(`   ✅ Updated auth_uid for ${email}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Database error for ${email}:`, error.message);
    return false;
  }
}

/**
 * Verify user exists in our database
 */
async function verifyUserInDatabase(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, auth_uid')
      .eq('email', email)
      .single();

    if (error) {
      console.error(`   ❌ User not found in database: ${email}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`   ❌ Database error checking ${email}:`, error.message);
    return null;
  }
}

/**
 * Main setup function
 */
async function setupCleanTestUsers() {
  console.log('🚀 Setting up Clean HostelHaven Test Users');
  console.log('==========================================\n');

  const results = {
    created: 0,
    existing: 0,
    failed: 0,
    updated: 0,
    notFound: 0
  };

  for (const user of cleanTestUsers) {
    console.log(`\n📧 Processing: ${user.email} (${user.role})`);
    
    // Step 1: Verify user exists in our database
    const dbUser = await verifyUserInDatabase(user.email);
    if (!dbUser) {
      console.log(`   ❌ User not found in database: ${user.email}`);
      results.notFound++;
      continue;
    }

    // Step 2: Create auth user
    const authResult = await createAuthUser(user);
    
    if (authResult.success) {
      results.created++;
      
      // Step 3: Update auth_uid in database
      const updateSuccess = await updateUserAuthUid(user.email, authResult.userId);
      if (updateSuccess) {
        results.updated++;
      }
      
    } else if (authResult.exists) {
      results.existing++;
      console.log(`   ℹ️  User exists, checking auth_uid...`);
      
      // Check if auth_uid is already set
      if (!dbUser.auth_uid) {
        console.log(`   ⚠️  Auth UID not set in database for existing user`);
        // You might want to fetch the auth user ID and update it
      } else {
        console.log(`   ✅ Auth UID already set: ${dbUser.auth_uid}`);
      }
      
    } else {
      results.failed++;
    }
  }

  // Summary
  console.log('\n📊 Setup Summary');
  console.log('================');
  console.log(`✅ Created: ${results.created}`);
  console.log(`⚠️  Existing: ${results.existing}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🔄 Updated: ${results.updated}`);
  console.log(`🔍 Not Found in DB: ${results.notFound}`);

  if (results.failed > 0 || results.notFound > 0) {
    console.log('\n⚠️  Some users had issues. Please check the errors above.');
    console.log('💡 Make sure you have run the clean-test-data.sql script first.');
  } else {
    console.log('\n🎉 All clean test credentials set up successfully!');
  }

  console.log('\n🔐 Clean Test Credentials:');
  console.log('==========================');
  console.log('Admin: admin@test.com / Test123!');
  console.log('Warden: warden@test.com / Test123!');
  console.log('Operations: ops@test.com / Test123!');
  console.log('Student: student@test.com / Test123!');
  console.log('Parent: parent@test.com / Test123!');
  
  console.log('\n🧪 Testing Instructions:');
  console.log('========================');
  console.log('1. Run the clean-test-data.sql script first');
  console.log('2. Run this script to set up auth credentials');
  console.log('3. Start the backend server: node server.js');
  console.log('4. Start the frontend: npm run dev (in frontend directory)');
  console.log('5. Go to http://localhost:5173/login');
  console.log('6. Test each role with the credentials above');
  console.log('7. Each login should redirect to the appropriate dashboard');
}

// Run the setup
if (require.main === module) {
  setupCleanTestUsers()
    .then(() => {
      console.log('\n✅ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupCleanTestUsers };
