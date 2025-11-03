const { supabase } = require('./config/supabase');

/**
 * Utility function to ensure room_id synchronization
 * Call this function whenever room allocations are created or updated
 */
async function ensureRoomIdSync(userId, roomId, operation = 'update') {
  try {
    console.log(`🔄 Ensuring room_id sync for user ${userId}, room ${roomId} (${operation})`);
    
    if (!userId || !roomId) {
      console.warn('⚠️ Missing userId or roomId for sync');
      return { success: false, error: 'Missing required parameters' };
    }

    // Update the user's room_id
    const { error: updateError } = await supabase
      .from('users')
      .update({
        room_id: roomId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to sync room_id:', updateError);
      return { success: false, error: updateError };
    }

    console.log('✅ Room_id sync successful');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Unexpected error in room_id sync:', error);
    return { success: false, error };
  }
}

/**
 * Utility function to clear room_id when room allocation is removed
 */
async function clearRoomIdSync(userId) {
  try {
    console.log(`🔄 Clearing room_id for user ${userId}`);
    
    if (!userId) {
      console.warn('⚠️ Missing userId for room_id clear');
      return { success: false, error: 'Missing userId' };
    }

    // Clear the user's room_id
    const { error: updateError } = await supabase
      .from('users')
      .update({
        room_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Failed to clear room_id:', updateError);
      return { success: false, error: updateError };
    }

    console.log('✅ Room_id cleared successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Unexpected error clearing room_id:', error);
    return { success: false, error };
  }
}

/**
 * Batch sync function to fix multiple users at once
 */
async function batchSyncRoomIds() {
  try {
    console.log('🔄 Starting batch room_id sync...');
    
    // Get all active room allocations
    const { data: allocations, error: allocationsError } = await supabase
      .from('room_allocations')
      .select(`
        room_id,
        user_profiles!inner(
          user_id,
          users!inner(
            id,
            room_id
          )
        )
      `)
      .in('allocation_status', ['confirmed', 'active']);

    if (allocationsError) {
      console.error('❌ Failed to fetch allocations:', allocationsError);
      return { success: false, error: allocationsError };
    }

    if (!allocations || allocations.length === 0) {
      console.log('ℹ️ No active allocations found');
      return { success: true, synced: 0 };
    }

    let syncedCount = 0;
    let errorCount = 0;

    for (const allocation of allocations) {
      const user = allocation.user_profiles?.users;
      if (user && user.room_id !== allocation.room_id) {
        const result = await ensureRoomIdSync(user.id, allocation.room_id, 'batch-sync');
        if (result.success) {
          syncedCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log(`✅ Batch sync completed: ${syncedCount} synced, ${errorCount} errors`);
    return { success: true, synced: syncedCount, errors: errorCount };
    
  } catch (error) {
    console.error('❌ Unexpected error in batch sync:', error);
    return { success: false, error };
  }
}

module.exports = {
  ensureRoomIdSync,
  clearRoomIdSync,
  batchSyncRoomIds
};
