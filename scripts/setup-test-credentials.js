#!/usr/bin/env node

/**
 * HostelHaven Test Credentials Setup Script
 * 
 * This script creates authentication users in Supabase Auth
 * for all the test users defined in our database.
 * 
 * Usage: node scripts/setup-test-credentials.js
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

// Test user credentials
const testUsers = [
  // Staff Users
  {
    email: 'admin@hostelhaven.com',
    password: 'Admin123!',
    fullName: 'Dr. Admin Manager',
    role: 'admin'
  },
  {
    email: 'warden@hostelhaven.com',
    password: 'Warden123!',
    fullName: 'Ms. Warden Supervisor',
    role: 'warden'
  },
  {
    email: 'operations@hostelhaven.com',
    password: 'Ops123!',
    fullName: 'Mr. Operations Manager',
    role: 'hostel_operations_assistant'
  },
  
  // Student Users
  {
    email: 'john.smith@student.edu',
    password: 'Student123!',
    fullName: 'John Smith',
    role: 'student'
  },
  {
    email: 'sarah.johnson@student.edu',
    password: 'Student123!',
    fullName: 'Sarah Johnson',
    role: 'student'
  },
  {
    email: 'david.wilson@student.edu',
    password: 'Student123!',
    fullName: 'David Wilson',
    role: 'student'
  },
  {
    email: 'emily.brown@student.edu',
    password: 'Student123!',
    fullName: 'Emily Brown',
    role: 'student'
  },
  {
    email: 'michael.davis@student.edu',
    password: 'Student123!',
    fullName: 'Michael Davis',
    role: 'student'
  },
  {
    email: 'jessica.miller@student.edu',
    password: 'Student123!',
    fullName: 'Jessica Miller',
    role: 'student'
  },
  {
    email: 'christopher.garcia@student.edu',
    password: 'Student123!',
    fullName: 'Christopher Garcia',
    role: 'student'
  },
  {
    email: 'amanda.rodriguez@student.edu',
    password: 'Student123!',
    fullName: 'Amanda Rodriguez',
    role: 'student'
  },
  {
    email: 'matthew.martinez@student.edu',
    password: 'Student123!',
    fullName: 'Matthew Martinez',
    role: 'student'
  },
  {
    email: 'ashley.anderson@student.edu',
    password: 'Student123!',
    fullName: 'Ashley Anderson',
    role: 'student'
  },
  
  // Parent Users
  {
    email: 'robert.smith@email.com',
    password: 'Parent123!',
    fullName: 'Robert Smith',
    role: 'parent'
  },
  {
    email: 'michael.johnson@email.com',
    password: 'Parent123!',
    fullName: 'Michael Johnson',
    role: 'parent'
  },
  {
    email: 'linda.wilson@email.com',
    password: 'Parent123!',
    fullName: 'Linda Wilson',
    role: 'parent'
  },
  {
    email: 'james.brown@email.com',
    password: 'Parent123!',
    fullName: 'James Brown',
    role: 'parent'
  },
  {
    email: 'patricia.davis@email.com',
    password: 'Parent123!',
    fullName: 'Patricia Davis',
    role: 'parent'
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
      email_confirm: true, // Auto-confirm for test users
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
async function setupTestCredentials() {
  console.log('🚀 Starting HostelHaven Test Credentials Setup');
  console.log('==============================================\n');

  const results = {
    created: 0,
    existing: 0,
    failed: 0,
    updated: 0,
    notFound: 0
  };

  for (const user of testUsers) {
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
    console.log('💡 Make sure you have run the test-data-seed.sql script first.');
  } else {
    console.log('\n🎉 All test credentials set up successfully!');
  }

  console.log('\n🔐 Test Credentials:');
  console.log('===================');
  console.log('Staff:');
  console.log('  Admin: admin@hostelhaven.com / Admin123!');
  console.log('  Warden: warden@hostelhaven.com / Warden123!');
  console.log('  Operations: operations@hostelhaven.com / Ops123!');
  console.log('\nStudents: [email] / Student123!');
  console.log('Parents: [email] / Parent123!');
  
  console.log('\n🧪 Next Steps:');
  console.log('1. Test login with the credentials above');
  console.log('2. Verify role-based access works');
  console.log('3. Test the complete workflow');
}

// Run the setup
if (require.main === module) {
  setupTestCredentials()
    .then(() => {
      console.log('\n✅ Setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupTestCredentials };
