// Load environment variables
require('dotenv').config({ path: './config.env' });

const { supabase } = require('./config/supabase');

async function debugRoomAllocations() {
  try {
    console.log('🔍 Debugging room allocations...');
    
    // Check room_allocations table
    const { data: allocations, error: allocationError } = await supabase
      .from('room_allocations')
      .select('*')
      .limit(10);
    
    if (allocationError) {
      console.error('Error fetching allocations:', allocationError);
      return;
    }
    
    console.log('📊 Room allocations found:', allocations?.length || 0);
    if (allocations && allocations.length > 0) {
      console.log('Sample allocations:');
      allocations.forEach((allocation, index) => {
        console.log(`${index + 1}. ID: ${allocation.id}, Room: ${allocation.room_id}, Status: ${allocation.allocation_status}, Student Profile: ${allocation.student_profile_id}`);
      });
    }
    
    // Check users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email, room_id')
      .limit(10);
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }
    
    console.log('\n👥 Users found:', users?.length || 0);
    if (users && users.length > 0) {
      console.log('Sample users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email}, Room ID: ${user.room_id || 'NULL'}`);
      });
    }
    
    // Check user_profiles table
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id, admission_number')
      .limit(10);
    
    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      return;
    }
    
    console.log('\n👤 User profiles found:', profiles?.length || 0);
    if (profiles && profiles.length > 0) {
      console.log('Sample profiles:');
      profiles.forEach((profile, index) => {
        console.log(`${index + 1}. Profile ID: ${profile.id}, User ID: ${profile.user_id}, Admission: ${profile.admission_number}`);
      });
    }
    
    // Check rooms table
    const { data: rooms, error: roomError } = await supabase
      .from('rooms')
      .select('id, room_number, floor, room_type')
      .limit(10);
    
    if (roomError) {
      console.error('Error fetching rooms:', roomError);
      return;
    }
    
    console.log('\n🏠 Rooms found:', rooms?.length || 0);
    if (rooms && rooms.length > 0) {
      console.log('Sample rooms:');
      rooms.forEach((room, index) => {
        console.log(`${index + 1}. ID: ${room.id}, Number: ${room.room_number}, Floor: ${room.floor}, Type: ${room.room_type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the debug
debugRoomAllocations();
