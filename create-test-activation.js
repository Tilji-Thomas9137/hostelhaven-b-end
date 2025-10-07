// Create a test activation token for testing
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { generateActivationToken, generateOtpCode, getExpiryFromNowHours, getExpiryFromNowMinutes } = require('./utils/security');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestActivation() {
  console.log('🧪 Creating Test Activation Token...\n');
  
  try {
    // Generate test activation data
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testUsername = `TEST${timestamp}`;
    const testRole = 'student';
    
    const activation_token = generateActivationToken();
    const activation_expires_at = getExpiryFromNowHours(24);
    const otp_code = generateOtpCode();
    const otp_expires_at = getExpiryFromNowMinutes(10);
    
    console.log('📋 Test Activation Data:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Username: ${testUsername}`);
    console.log(`   Role: ${testRole}`);
    console.log(`   Activation Token: ${activation_token}`);
    console.log(`   OTP Code: ${otp_code}`);
    console.log(`   Token Expires: ${new Date(activation_expires_at).toLocaleString()}`);
    console.log(`   OTP Expires: ${new Date(otp_expires_at).toLocaleString()}\n`);
    
    // Create test user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: testEmail,
        full_name: 'Test User',
        phone: '1234567890',
        role: testRole,
        username: testUsername,
        status: 'inactive',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        activation_token: activation_token,
        activation_expires_at: activation_expires_at,
        otp_code: otp_code,
        otp_expires_at: otp_expires_at
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating test user:', userError.message);
      return;
    }

    console.log('✅ Test user created successfully!');
    console.log(`   User ID: ${newUser.id}`);
    
    console.log('\n🎯 TEST ACTIVATION URL:');
    console.log(`http://localhost:5173/activate?token=${activation_token}`);
    
    console.log('\n📋 TEST CREDENTIALS:');
    console.log(`   OTP Code: ${otp_code}`);
    console.log(`   Password: (set during activation)`);
    console.log(`   Username for login: ${testUsername}`);
    
    console.log('\n🔧 TESTING STEPS:');
    console.log('1. Copy the activation URL above');
    console.log('2. Open it in your browser');
    console.log('3. Enter the OTP code');
    console.log('4. Set a password');
    console.log('5. Click "Activate Account"');
    console.log('6. Try logging in with the username and password');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestActivation();
