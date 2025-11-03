// Load environment variables
require('dotenv').config({ path: './config.env' });

const { supabase } = require('./config/supabase');

async function fixUsersRoomIdColumn() {
  try {
    console.log('🔧 Fixing users table schema...');
    
    // Check if room_id column exists by trying to select it
    const { data: testData, error: columnError } = await supabase
      .from('users')
      .select('room_id')
      .limit(1);
    
    if (columnError) {
      if (columnError.code === '42703') { // Column doesn't exist
        console.log('❌ room_id column missing from users table');
        console.log('Please run the SQL script manually to add the column:');
        console.log('ALTER TABLE users ADD COLUMN room_id UUID;');
        console.log('ALTER TABLE users ADD CONSTRAINT fk_users_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;');
        return;
      } else {
        console.error('Error checking columns:', columnError);
        return;
      }
    } else {
      console.log('✅ room_id column exists in users table');
    }
    
    // Sync existing room allocations
    console.log('🔄 Syncing existing room allocations...');
    
    // First get all user profiles with their user_id
    const { data: userProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id');
    
    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
      return;
    }
    
    // Create a map of profile_id to user_id
    const profileToUserMap = {};
    userProfiles?.forEach(profile => {
      profileToUserMap[profile.id] = profile.user_id;
    });
    
    // Get room allocations
    const { data: allocations, error: allocationError } = await supabase
      .from('room_allocations')
      .select('room_id, student_profile_id')
      .in('allocation_status', ['confirmed', 'active'])
      .not('room_id', 'is', null);
    
    if (allocationError) {
      console.error('Error fetching allocations:', allocationError);
      return;
    }
    
    let updatedCount = 0;
    
    for (const allocation of allocations || []) {
      const userId = profileToUserMap[allocation.student_profile_id];
      if (userId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ room_id: allocation.room_id })
          .eq('id', userId)
          .is('room_id', null); // Only update if room_id is currently null
        
        if (updateError) {
          console.error(`Error updating user ${userId}:`, updateError);
        } else {
          updatedCount++;
          console.log(`✅ Updated user ${userId} with room ${allocation.room_id}`);
        }
      }
    }
    
    console.log(`🎉 Sync completed! Updated ${updatedCount} users.`);
    
    // Verify the results
    const { data: usersWithRooms, error: verifyError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        room_id,
        rooms!inner(room_number, floor, room_type)
      `)
      .not('room_id', 'is', null);
    
    if (verifyError) {
      console.error('Error verifying results:', verifyError);
      return;
    }
    
    console.log('\n📊 Users with room assignments:');
    usersWithRooms?.forEach(user => {
      console.log(`- ${user.full_name} (${user.email}) → Room ${user.rooms.room_number} (${user.rooms.room_type})`);
    });
    
    console.log(`\nTotal users with room assignments: ${usersWithRooms?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixUsersRoomIdColumn();
