// Debug activation token issue
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugActivation() {
  console.log('🔍 Debugging Activation Token Issue...\n');
  
  try {
    // Check if there are any users with activation tokens
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, username, role, activation_token, activation_expires_at, otp_code, otp_expires_at, status')
      .not('activation_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }

    console.log(`📊 Found ${users.length} users with activation tokens:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. User: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Activation Token: ${user.activation_token ? user.activation_token.substring(0, 20) + '...' : 'None'}`);
      console.log(`   Token Expires: ${user.activation_expires_at ? new Date(user.activation_expires_at).toLocaleString() : 'None'}`);
      console.log(`   OTP Code: ${user.otp_code || 'None'}`);
      console.log(`   OTP Expires: ${user.otp_expires_at ? new Date(user.otp_expires_at).toLocaleString() : 'None'}`);
      
      // Check if token is expired
      if (user.activation_expires_at) {
        const isExpired = new Date(user.activation_expires_at).getTime() < Date.now();
        console.log(`   Token Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
      }
      
      // Check if OTP is expired
      if (user.otp_expires_at) {
        const isOtpExpired = new Date(user.otp_expires_at).getTime() < Date.now();
        console.log(`   OTP Status: ${isOtpExpired ? '❌ EXPIRED' : '✅ VALID'}`);
      }
      
      console.log('');
    });

    if (users.length === 0) {
      console.log('❌ No users found with activation tokens');
      console.log('💡 This means either:');
      console.log('   1. No users have been created yet');
      console.log('   2. All users have already been activated');
      console.log('   3. Activation tokens have been cleared');
    } else {
      console.log('🎯 TESTING ACTIVATION:');
      console.log('Use one of the tokens above to test activation');
      console.log('Example URL: http://localhost:5173/activate?token=' + users[0].activation_token);
    }

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

debugActivation();
