const { createClient } = require('@supabase/supabase-js');
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

async function addTestOutpassData() {
  try {
    console.log('🚀 Adding test outpass data...');
    
    // First, check if there are any users in the system
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, auth_uid, role')
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log('👥 Found users:', users?.length || 0);
    if (users && users.length > 0) {
      console.log('Sample users:', users.map(u => ({ name: u.full_name, email: u.email, role: u.role })));
    }

    // Check current outpass requests
    const { data: currentRequests, error: currentError } = await supabase
      .from('outpass_requests')
      .select('id')
      .limit(1);

    if (currentError) {
      console.error('❌ Error checking current outpass requests:', currentError);
      return;
    }

    console.log('📋 Current outpass requests:', currentRequests?.length || 0);

    // Find a student user to add test data for
    const studentUser = users?.find(u => u.role === 'student');
    
    if (!studentUser) {
      console.log('❌ No student users found. Cannot add test outpass data.');
      return;
    }

    console.log('🎓 Using student:', studentUser.full_name, studentUser.email);

    // Add test outpass request 1 - Pending
    const { data: outpass1, error: error1 } = await supabase
      .from('outpass_requests')
      .insert({
        user_id: studentUser.id,
        reason: 'Medical emergency - need to visit hospital for checkup',
        destination: 'City General Hospital',
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Day after tomorrow
        start_time: '09:00:00',
        end_time: '18:00:00',
        transport_mode: 'taxi',
        emergency_contact: 'Dr. Smith',
        emergency_phone: '9876543210',
        parent_approval: true,
        status: 'pending'
      })
      .select('id');

    if (error1) {
      console.error('❌ Error adding test outpass 1:', error1);
    } else {
      console.log('✅ Added test outpass request 1 (pending):', outpass1[0]?.id);
    }

    // Add test outpass request 2 - Approved
    const { data: outpass2, error: error2 } = await supabase
      .from('outpass_requests')
      .insert({
        user_id: studentUser.id,
        reason: 'Family function - cousin wedding ceremony',
        destination: 'Grand Hotel, Mumbai',
        start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
        end_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
        start_time: '08:00:00',
        end_time: '22:00:00',
        transport_mode: 'train',
        emergency_contact: 'Aunt Mary',
        emergency_phone: '9876543211',
        parent_approval: true,
        status: 'approved',
        approved_by: studentUser.id, // Using student as approver for test
        approved_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id');

    if (error2) {
      console.error('❌ Error adding test outpass 2:', error2);
    } else {
      console.log('✅ Added test outpass request 2 (approved):', outpass2[0]?.id);
    }

    // Add test outpass request 3 - Rejected
    const { data: outpass3, error: error3 } = await supabase
      .from('outpass_requests')
      .insert({
        user_id: studentUser.id,
        reason: 'Weekend trip with friends',
        destination: 'Goa Beach Resort',
        start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next week
        end_date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days later
        start_time: '06:00:00',
        end_time: '23:00:00',
        transport_mode: 'bus',
        emergency_contact: 'Friend John',
        emergency_phone: '9876543212',
        parent_approval: true,
        status: 'rejected',
        approved_by: studentUser.id, // Using student as approver for test
        approved_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        rejection_reason: 'Request denied due to insufficient documentation and no urgent need.'
      })
      .select('id');

    if (error3) {
      console.error('❌ Error adding test outpass 3:', error3);
    } else {
      console.log('✅ Added test outpass request 3 (rejected):', outpass3[0]?.id);
    }

    // Verify the data was added
    const { data: finalRequests, error: finalError } = await supabase
      .from('outpass_requests')
      .select(`
        id,
        reason,
        destination,
        status,
        created_at,
        users!outpass_requests_user_id_fkey(full_name, email)
      `)
      .eq('user_id', studentUser.id)
      .order('created_at', { ascending: false });

    if (finalError) {
      console.error('❌ Error verifying final data:', finalError);
    } else {
      console.log('🎉 Final outpass requests for student:');
      finalRequests?.forEach((req, index) => {
        console.log(`${index + 1}. ${req.reason} - ${req.status} (${req.destination})`);
      });
    }

    console.log('✅ Test outpass data addition completed!');
    
  } catch (error) {
    console.error('❌ Exception adding test outpass data:', error);
  }
}

// Run the function
addTestOutpassData();
