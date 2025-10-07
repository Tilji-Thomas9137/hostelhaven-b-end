// Test student creation via API
const fetch = require('node-fetch');

async function testStudentCreationAPI() {
  console.log('🧪 Testing Student Creation via API...');
  
  const testData = {
    admission_number: 'ADM2026001',
    full_name: 'Aswin Murali',
    course: 'MCA',
    year: 2,
    student_email: 'aswinmurali2026@mca.a',
    student_phone: '9562169137',
    parent_name: 'Muraleedharan',
    parent_phone: '9087354672',
    parent_email: 'tilji0119@gmail.com',
    parent_relation: 'Father'
  };

  try {
    console.log('📤 Sending request to create student...');
    console.log('📋 Data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:3002/api/admission-registry/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You might need a real token
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Student created successfully!');
      console.log('📧 Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Student creation failed:');
      console.log('📧 Status:', response.status);
      console.log('📧 Response:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

// Wait a moment for server to start
setTimeout(() => {
  testStudentCreationAPI();
}, 3000);
