// Load environment variables
require('dotenv').config({ path: './config.env' });

const { supabase } = require('./config/supabase');

async function fixRoomAllocation() {
  try {
    console.log('🔧 Fixing room allocation with null student_profile_id...');
    
    // Get the problematic allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('id', 'ddfe63d7-24b2-4767-99e3-979d92e56e74')
      .single();
    
    if (allocationError) {
      console.error('Error fetching allocation:', allocationError);
      return;
    }
    
    console.log('📊 Problematic allocation:', allocation);
    
    // Get the room details
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', allocation.room_id)
      .single();
    
    if (roomError) {
      console.error('Error fetching room:', roomError);
      return;
    }
    
    console.log('🏠 Room details:', room);
    
    // Check if there are any room requests for this room
    const { data: requests, error: requestError } = await supabase
      .from('room_requests')
      .select(`
        *,
        user_profiles!inner(user_id, admission_number)
      `)
      .eq('room_id', allocation.room_id)
      .eq('status', 'pending');
    
    if (requestError) {
      console.error('Error fetching requests:', requestError);
      return;
    }
    
    console.log('📝 Room requests for this room:', requests?.length || 0);
    if (requests && requests.length > 0) {
      requests.forEach((request, index) => {
        console.log(`${index + 1}. Request ID: ${request.id}, User: ${request.user_profiles?.user_id}, Status: ${request.status}`);
      });
    }
    
    // Check if there are any users without room assignments
    const { data: usersWithoutRooms, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('role', 'student')
      .is('room_id', null);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log('\n👥 Students without room assignments:', usersWithoutRooms?.length || 0);
    if (usersWithoutRooms && usersWithoutRooms.length > 0) {
      usersWithoutRooms.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email}`);
      });
    }
    
    // If we have a student without a room, let's assign them
    if (usersWithoutRooms && usersWithoutRooms.length > 0) {
      const studentToAssign = usersWithoutRooms[0]; // Take the first student
      console.log(`\n🎯 Assigning room ${room.room_number} to student ${studentToAssign.full_name}...`);
      
      // Get the student's profile
      const { data: studentProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', studentToAssign.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching student profile:', profileError);
        return;
      }
      
      // Update the room allocation with the correct student_profile_id
      const { error: updateAllocationError } = await supabase
        .from('room_allocations')
        .update({ student_profile_id: studentProfile.id })
        .eq('id', allocation.id);
      
      if (updateAllocationError) {
        console.error('Error updating allocation:', updateAllocationError);
        return;
      }
      
      // Update the user's room_id
      const { error: updateUserError } = await supabase
        .from('users')
        .update({ room_id: allocation.room_id })
        .eq('id', studentToAssign.id);
      
      if (updateUserError) {
        console.error('Error updating user:', updateUserError);
        return;
      }
      
      console.log(`✅ Successfully assigned room ${room.room_number} to ${studentToAssign.full_name}!`);
      
      // Verify the fix
      const { data: updatedUser, error: verifyError } = await supabase
        .from('users')
        .select('id, full_name, email, room_id')
        .eq('id', studentToAssign.id)
        .single();
      
      if (verifyError) {
        console.error('Error verifying update:', verifyError);
        return;
      }
      
      console.log('🔍 Verification - Updated user:', updatedUser);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixRoomAllocation();
