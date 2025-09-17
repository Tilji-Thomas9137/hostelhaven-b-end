// Test the API endpoint directly
const fetch = require('node-fetch');

async function testAPIEndpoint() {
  console.log('Testing API endpoint...');
  
  try {
    // Test data that includes both user_profiles and users fields
    const testData = {
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
      
      // users fields (should be filtered out from user_profiles)
      full_name: 'Test User Full Name',
      phone: '1234567890',
      email: 'testuser@example.com'
    };

    const response = await fetch('http://localhost:3002/api/user-profiles/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This will fail auth, but we can see the field filtering
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', result);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPIEndpoint();


