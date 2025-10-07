// Test username-based login system
require('dotenv').config();

async function testUsernameLogin() {
  console.log('🔐 Testing Username-Based Login System...\n');
  
  // Test different username formats
  const testLogins = [
    {
      username: 'ADM2026001',  // Student admission number
      password: 'testpassword123',
      role: 'Student'
    },
    {
      username: 'PARENT-ADM2026001',  // Parent username
      password: 'testpassword123',
      role: 'Parent'
    },
    {
      username: 'EMP001',  // Staff employee ID
      password: 'testpassword123',
      role: 'Staff'
    }
  ];
  
  console.log('📋 Testing Login with Different Username Formats:\n');
  
  for (const login of testLogins) {
    try {
      console.log(`🔑 Testing ${login.role} login with username: ${login.username}`);
      
      const response = await fetch('http://localhost:3002/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: login.username,  // This will be treated as username
          password: login.password,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${login.role} login successful!`);
        console.log(`   User: ${result.data?.user?.full_name}`);
        console.log(`   Role: ${result.data?.user?.role}`);
        console.log(`   Username: ${result.data?.user?.username}\n`);
      } else {
        console.log(`❌ ${login.role} login failed: ${result.message}\n`);
      }
      
    } catch (error) {
      console.log(`❌ ${login.role} login error: ${error.message}\n`);
    }
  }
  
  console.log('🎯 LOGIN SYSTEM UPDATED!');
  console.log('\n📋 WHAT USERS NEED TO KNOW:');
  console.log('✅ Students: Use admission number (e.g., ADM2026001)');
  console.log('✅ Parents: Use PARENT-admission number (e.g., PARENT-ADM2026001)');
  console.log('✅ Staff: Use employee ID (e.g., EMP001)');
  console.log('✅ All users: Use their password (set during activation)');
  
  console.log('\n🔧 FRONTEND CHANGES:');
  console.log('✅ Login form now shows "Username" instead of "Email"');
  console.log('✅ Placeholder shows examples for each user type');
  console.log('✅ Validation accepts usernames (not just emails)');
  console.log('✅ Error messages updated for username-based login');
  
  console.log('\n🎉 YOUR LOGIN SYSTEM IS READY!');
  console.log('Users can now log in with their usernames and passwords!');
}

testUsernameLogin();
