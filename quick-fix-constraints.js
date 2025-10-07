const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: './config.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your config.env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function quickFixConstraints() {
  console.log('🚀 Quick fix for foreign key constraints...\n');
  
  try {
    // Step 1: Find all user_profiles that might be causing issues
    const { data: allProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, user_id, admission_number');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError.message);
      return;
    }

    console.log(`Found ${allProfiles.length} user profiles`);

    // Step 2: Check which ones have orphaned references
    const problematicProfiles = [];
    
    for (const profile of allProfiles) {
      // Check if the user still exists
      if (profile.user_id) {
        const { data: userExists } = await supabase
          .from('users')
          .select('id')
          .eq('id', profile.user_id)
          .single();

        if (!userExists) {
          problematicProfiles.push(profile);
          console.log(`⚠️  Orphaned profile: ID ${profile.id}, User ID ${profile.user_id}, Admission ${profile.admission_number}`);
        }
      }
    }

    // Step 3: Delete problematic profiles
    if (problematicProfiles.length > 0) {
      console.log(`\n🗑️  Deleting ${problematicProfiles.length} problematic profiles...`);
      
      for (const profile of problematicProfiles) {
        const { error: deleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', profile.id);

        if (deleteError) {
          console.error(`❌ Failed to delete profile ${profile.id}:`, deleteError.message);
        } else {
          console.log(`✅ Deleted problematic profile ${profile.id}`);
        }
      }
    } else {
      console.log('✅ No problematic profiles found');
    }

    // Step 4: Check for admission registry entries without users
    const { data: admissionEntries, error: admissionError } = await supabase
      .from('admission_registry')
      .select('admission_number, student_email');

    if (admissionError) {
      console.error('Error checking admission entries:', admissionError.message);
      return;
    }

    console.log(`\n🔍 Checking ${admissionEntries.length} admission entries...`);

    const orphanedAdmissions = [];
    
    for (const entry of admissionEntries) {
      const { data: userExists } = await supabase
        .from('users')
        .select('id')
        .eq('email', entry.student_email)
        .single();

      if (!userExists) {
        orphanedAdmissions.push(entry);
        console.log(`⚠️  Orphaned admission: ${entry.admission_number} (${entry.student_email})`);
      }
    }

    // Step 5: Clean up orphaned admissions
    if (orphanedAdmissions.length > 0) {
      console.log(`\n🗑️  Deleting ${orphanedAdmissions.length} orphaned admission entries...`);
      
      for (const entry of orphanedAdmissions) {
        const { error: deleteError } = await supabase
          .from('admission_registry')
          .delete()
          .eq('admission_number', entry.admission_number);

        if (deleteError) {
          console.error(`❌ Failed to delete admission ${entry.admission_number}:`, deleteError.message);
        } else {
          console.log(`✅ Deleted orphaned admission ${entry.admission_number}`);
        }
      }
    } else {
      console.log('✅ No orphaned admission entries found');
    }

    console.log('\n✅ Quick fix completed! You should now be able to delete students without foreign key constraint errors.');
    
  } catch (error) {
    console.error('❌ Error during quick fix:', error.message);
  }
}

// Run the quick fix
quickFixConstraints().then(() => {
  console.log('\n🎉 Quick fix process completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
