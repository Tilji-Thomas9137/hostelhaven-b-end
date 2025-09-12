require('dotenv').config({ path: './config.env' });
const { supabase } = require('../config/supabase');

async function createOperationsUser() {
  try {
    console.log('🔍 Checking existing users...');
    
    // Get all users
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    console.log(`📊 Found ${allUsers.length} users:`);
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.full_name} (${user.email}) - Role: ${user.role}`);
    });
    
    if (allUsers.length > 0) {
      console.log('\n🔄 Updating first user to operations assistant role...');
      
      const firstUser = allUsers[0];
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: 'hostel_operations_assistant' })
        .eq('id', firstUser.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Error updating user:', updateError);
      } else {
        console.log('✅ Successfully updated user to operations assistant:');
        console.log(`   ${updatedUser.full_name} (${updatedUser.email}) - Role: ${updatedUser.role}`);
        console.log('\n🎉 You can now access the operations dashboard with this user!');
      }
    } else {
      console.log('⚠️  No users found. Please create a user first.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createOperationsUser();
