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

async function cleanDuplicateUsers() {
  console.log('🔍 Checking for duplicate users...');
  
  try {
    // Find duplicate emails
    const { data: duplicates, error } = await supabase
      .from('users')
      .select('email, count(*)')
      .group('email')
      .having('count(*)', '>', 1);

    if (error) {
      console.error('Error finding duplicates:', error.message);
      return;
    }

    if (!duplicates || duplicates.length === 0) {
      console.log('✅ No duplicate users found!');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} duplicate email addresses:`);
    
    for (const duplicate of duplicates) {
      console.log(`   - ${duplicate.email} (${duplicate.count} entries)`);
      
      // Get all users with this email
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', duplicate.email)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error(`Error fetching users for ${duplicate.email}:`, fetchError.message);
        continue;
      }

      // Keep the first user, delete the rest
      const usersToDelete = users.slice(1);
      
      for (const userToDelete of usersToDelete) {
        console.log(`   🗑️  Deleting duplicate user: ${userToDelete.id} (${userToDelete.role})`);
        
        // Step 1: Delete user_profiles first to avoid foreign key constraints
        const { error: profileDeleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('user_id', userToDelete.id);

        if (profileDeleteError) {
          console.warn(`   ⚠️  Failed to delete user profile ${userToDelete.id}:`, profileDeleteError.message);
        }

        // Step 2: Delete from users table
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', userToDelete.id);

        if (deleteError) {
          console.error(`   ❌ Failed to delete user ${userToDelete.id}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted duplicate user ${userToDelete.id}`);
        }
      }
    }

    console.log('✅ Duplicate cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

async function checkDatabaseIntegrity() {
  console.log('🔍 Checking database integrity...');
  
  try {
    // Check for users without proper email format
    const { data: invalidEmails, error } = await supabase
      .from('users')
      .select('id, email, role')
      .not('email', 'like', '%@%');

    if (error) {
      console.error('Error checking email format:', error.message);
      return;
    }

    if (invalidEmails && invalidEmails.length > 0) {
      console.log('⚠️  Found users with invalid email format:');
      invalidEmails.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
      });
    } else {
      console.log('✅ All emails have valid format');
    }

    // Check for orphaned user_profiles
    const { data: orphanedProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id, admission_number')
      .is('user_id', null);

    if (profileError) {
      console.error('Error checking orphaned profiles:', profileError.message);
    } else if (orphanedProfiles && orphanedProfiles.length > 0) {
      console.log('⚠️  Found orphaned user profiles:');
      orphanedProfiles.forEach(profile => {
        console.log(`   - Profile ID: ${profile.id}, User ID: ${profile.user_id}, Admission: ${profile.admission_number}`);
      });
    } else {
      console.log('✅ No orphaned user profiles found');
    }

    // Check for admission registry entries without corresponding users
    const { data: admissionEntries, error: admissionError } = await supabase
      .from('admission_registry')
      .select('admission_number, student_email');

    if (admissionError) {
      console.error('Error checking admission entries:', admissionError.message);
    } else if (admissionEntries && admissionEntries.length > 0) {
      console.log('🔍 Checking admission entries for missing user accounts...');
      
      for (const entry of admissionEntries) {
        const { data: userExists } = await supabase
          .from('users')
          .select('id')
          .eq('email', entry.student_email)
          .single();

        if (!userExists) {
          console.log(`   ⚠️  Admission ${entry.admission_number} has no corresponding user account for ${entry.student_email}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking database integrity:', error.message);
  }
}

async function cleanOrphanedRecords() {
  console.log('🧹 Cleaning up orphaned records...');
  
  try {
    // Clean up orphaned user_profiles
    const { data: orphanedProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .is('user_id', null);

    if (profileError) {
      console.error('Error finding orphaned profiles:', profileError.message);
      return;
    }

    if (orphanedProfiles && orphanedProfiles.length > 0) {
      console.log(`🗑️  Found ${orphanedProfiles.length} orphaned user profiles, cleaning up...`);
      
      for (const profile of orphanedProfiles) {
        const { error: deleteError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', profile.id);

        if (deleteError) {
          console.error(`   ❌ Failed to delete orphaned profile ${profile.id}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted orphaned profile ${profile.id}`);
        }
      }
    } else {
      console.log('✅ No orphaned user profiles found');
    }

    // Clean up orphaned admission registry entries without users
    const { data: admissionEntries, error: admissionError } = await supabase
      .from('admission_registry')
      .select('admission_number, student_email');

    if (admissionError) {
      console.error('Error checking admission entries:', admissionError.message);
      return;
    }

    if (admissionEntries && admissionEntries.length > 0) {
      console.log('🔍 Checking for orphaned admission entries...');
      
      for (const entry of admissionEntries) {
        const { data: userExists } = await supabase
          .from('users')
          .select('id')
          .eq('email', entry.student_email)
          .single();

        if (!userExists) {
          console.log(`   🗑️  Deleting orphaned admission entry: ${entry.admission_number}`);
          
          const { error: deleteError } = await supabase
            .from('admission_registry')
            .delete()
            .eq('admission_number', entry.admission_number);

          if (deleteError) {
            console.error(`   ❌ Failed to delete orphaned admission ${entry.admission_number}:`, deleteError.message);
          } else {
            console.log(`   ✅ Deleted orphaned admission ${entry.admission_number}`);
          }
        }
      }
    }

    console.log('✅ Orphaned records cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during orphaned records cleanup:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting database cleanup...\n');
  
  await checkDatabaseIntegrity();
  console.log('');
  await cleanOrphanedRecords();
  console.log('');
  await cleanDuplicateUsers();
  
  console.log('\n✅ Database cleanup completed!');
  process.exit(0);
}

// Run the cleanup
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
