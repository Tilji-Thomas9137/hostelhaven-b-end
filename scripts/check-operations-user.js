const { supabase } = require('../config/supabase');

async function checkOperationsUser() {
  try {
    console.log('🔍 Checking for operations users...');
    
    // Check if there are any users with operations role
    const { data: operationsUsers, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['hostel_operations_assistant', 'admin', 'warden']);
    
    if (error) {
      console.error('❌ Error checking users:', error);
      return;
    }
    
    console.log(`📊 Found ${operationsUsers.length} operations users:`);
    operationsUsers.forEach(user => {
      console.log(`  - ${user.full_name} (${user.email}) - Role: ${user.role}`);
    });
    
    if (operationsUsers.length === 0) {
      console.log('⚠️  No operations users found. You may need to:');
      console.log('   1. Create a user with hostel_operations_assistant role');
      console.log('   2. Or update an existing user\'s role to hostel_operations_assistant');
      console.log('   3. Or use admin/warden role for testing');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOperationsUser();
