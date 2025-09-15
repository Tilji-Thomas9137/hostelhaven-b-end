// Test script to verify user_profiles schema
require('dotenv').config({ path: './config.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSchema() {
  console.log('Testing user_profiles schema...');
  
  try {
    // Get the table schema
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Schema test failed:', error);
    } else {
      console.log('Schema test successful - table is accessible');
      
      // Test with sample data including Aadhar URLs
      const testData = {
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        admission_number: 'SCHEMA123',
        course: 'Schema Test',
        aadhar_front_url: 'https://example.com/front.jpg',
        aadhar_back_url: 'https://example.com/back.jpg',
        pincode: '123456',
        status: 'complete',
        profile_status: 'active'
      };

      const { data: insertData, error: insertError } = await supabase
        .from('user_profiles')
        .upsert(testData, { onConflict: 'user_id' })
        .select()
        .single();

      if (insertError) {
        console.error('Insert test failed:', insertError);
      } else {
        console.log('Insert test successful:', insertData);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSchema();
