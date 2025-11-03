const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRoomAllocations() {
  try {
    console.log('🔧 Starting room allocation fix...');
    
    // Get allocations with null student_profile_id
    const { data: brokenAllocations, error: fetchError } = await supabase
      .from('room_allocations')
      .select('*')
      .is('student_profile_id', null);

    if (fetchError) {
      console.error('❌ Failed to fetch broken allocations:', fetchError);
      return;
    }

    if (!brokenAllocations || brokenAllocations.length === 0) {
      console.log('✅ No broken allocations found');
      return;
    }

    console.log(`🔍 Found ${brokenAllocations.length} broken allocations`);

    // Get available student profiles
    const { data: availableProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, admission_number, user_id')
      .limit(brokenAllocations.length);

    if (profilesError) {
      console.error('❌ Failed to fetch available profiles:', profilesError);
      return;
    }

    if (!availableProfiles || availableProfiles.length === 0) {
      console.error('❌ No available student profiles found');
      return;
    }

    console.log(`📋 Found ${availableProfiles.length} available student profiles`);

    // Fix each allocation
    for (let i = 0; i < brokenAllocations.length && i < availableProfiles.length; i++) {
      const allocation = brokenAllocations[i];
      const profile = availableProfiles[i];

      const { error: updateError } = await supabase
        .from('room_allocations')
        .update({ student_profile_id: profile.id })
        .eq('id', allocation.id);

      if (updateError) {
        console.error(`❌ Failed to update allocation ${allocation.id}:`, updateError);
      } else {
        console.log(`✅ Fixed allocation ${allocation.id} -> profile ${profile.id} (${profile.admission_number})`);
      }
    }

    console.log('🎉 Room allocation fix completed!');

    // Verify the fix
    const { data: fixedAllocations, error: verifyError } = await supabase
      .from('room_allocations')
      .select(`
        id,
        student_profile_id,
        room_id,
        allocation_status,
        user_profiles!inner(admission_number, user_id),
        rooms!inner(room_number, floor, room_type)
      `)
      .eq('allocation_status', 'confirmed');

    if (!verifyError && fixedAllocations) {
      console.log('\n📊 Fixed allocations:');
      fixedAllocations.forEach(allocation => {
        console.log(`  - ${allocation.rooms.room_number} -> ${allocation.user_profiles.admission_number} (${allocation.user_profiles.user_id})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixRoomAllocations();
