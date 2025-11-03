const { supabase } = require('./config/supabase');

/**
 * Complete fix for room_id synchronization issue
 * This script ensures that users.room_id is properly synced with room_allocations
 */
async function fixRoomIdSync() {
  try {
    console.log('🔧 Starting comprehensive room_id synchronization fix...\n');

    // Step 1: Check current state
    console.log('📊 Step 1: Checking current state...');
    
    const { data: usersWithRooms, error: usersWithRoomsError } = await supabase
      .from('users')
      .select('id, full_name, email, room_id')
      .not('room_id', 'is', null);
    
    if (usersWithRoomsError) {
      console.error('❌ Error fetching users with rooms:', usersWithRoomsError);
      return;
    }

    const { data: usersWithoutRooms, error: usersWithoutRoomsError } = await supabase
      .from('users')
      .select('id, full_name, email, room_id')
      .eq('role', 'student')
      .is('room_id', null);
    
    if (usersWithoutRoomsError) {
      console.error('❌ Error fetching users without rooms:', usersWithoutRoomsError);
      return;
    }

    console.log(`✅ Users with room_id: ${usersWithRooms?.length || 0}`);
    console.log(`⚠️  Students without room_id: ${usersWithoutRooms?.length || 0}`);

    // Step 2: Check room_allocations table
    console.log('\n📊 Step 2: Checking room_allocations...');
    
    const { data: activeAllocations, error: allocationsError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        room_id,
        allocation_status,
        student_profile_id,
        user_profiles!inner(
          user_id,
          users!inner(
            id,
            full_name,
            email,
            room_id
          )
        )
      `)
      .in('allocation_status', ['confirmed', 'active']);

    if (allocationsError) {
      console.error('❌ Error fetching room allocations:', allocationsError);
      return;
    }

    console.log(`✅ Active room allocations: ${activeAllocations?.length || 0}`);

    // Step 3: Identify mismatches
    console.log('\n🔍 Step 3: Identifying synchronization issues...');
    
    const mismatches = [];
    const usersToUpdate = [];

    if (activeAllocations) {
      for (const allocation of activeAllocations) {
        const user = allocation.user_profiles?.users;
        if (user) {
          if (user.room_id !== allocation.room_id) {
            mismatches.push({
              userId: user.id,
              userName: user.full_name,
              currentRoomId: user.room_id,
              correctRoomId: allocation.room_id,
              allocationId: allocation.id
            });
            usersToUpdate.push({
              userId: user.id,
              roomId: allocation.room_id
            });
          }
        }
      }
    }

    console.log(`🔍 Found ${mismatches.length} synchronization mismatches`);

    if (mismatches.length > 0) {
      console.log('\n📋 Mismatches found:');
      mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. ${mismatch.userName} (ID: ${mismatch.userId})`);
        console.log(`   Current room_id: ${mismatch.currentRoomId || 'NULL'}`);
        console.log(`   Should be: ${mismatch.correctRoomId}`);
      });
    }

    // Step 4: Fix the mismatches
    if (usersToUpdate.length > 0) {
      console.log('\n🔧 Step 4: Fixing synchronization issues...');
      
      let successCount = 0;
      let errorCount = 0;

      for (const update of usersToUpdate) {
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({ room_id: update.roomId })
            .eq('id', update.userId);

          if (updateError) {
            console.error(`❌ Failed to update user ${update.userId}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ Updated user ${update.userId} with room_id ${update.roomId}`);
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error updating user ${update.userId}:`, error);
          errorCount++;
        }
      }

      console.log(`\n📊 Update Summary:`);
      console.log(`✅ Successfully updated: ${successCount} users`);
      console.log(`❌ Failed updates: ${errorCount} users`);
    }

    // Step 5: Verify the fix
    console.log('\n✅ Step 5: Verifying the fix...');
    
    const { data: finalUsersWithRooms, error: finalCheckError } = await supabase
      .from('users')
      .select('id, full_name, email, room_id')
      .not('room_id', 'is', null);

    if (finalCheckError) {
      console.error('❌ Error in final verification:', finalCheckError);
      return;
    }

    console.log(`✅ Final count - Users with room_id: ${finalUsersWithRooms?.length || 0}`);

    // Step 6: Show sample of fixed users
    if (finalUsersWithRooms && finalUsersWithRooms.length > 0) {
      console.log('\n📋 Sample of users with room assignments:');
      finalUsersWithRooms.slice(0, 5).forEach((user, index) => {
        console.log(`${index + 1}. ${user.full_name} (${user.email}) - Room ID: ${user.room_id}`);
      });
    }

    console.log('\n🎉 Room ID synchronization fix completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Test the frontend to ensure room_id is now being fetched correctly');
    console.log('2. Verify that the /api/auth/me endpoint returns roomId in the response');
    console.log('3. Check that the /api/rooms/my-room endpoint works properly');

  } catch (error) {
    console.error('❌ Unexpected error during room ID sync:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixRoomIdSync()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixRoomIdSync };
