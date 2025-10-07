// Fix duplicate username issue
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDuplicateUsername() {
  console.log('🔍 Checking for duplicate username issues...');
  
  const problemEmail = 'tilji0119@gmail.com';
  
  try {
    // Check if the email exists as a username
    const { data: userByUsername, error: usernameError } = await supabase
      .from('users')
      .select('*')
      .eq('username', problemEmail)
      .single();

    if (usernameError && usernameError.code !== 'PGRST116') {
      console.error('Error checking username:', usernameError.message);
      return;
    }

    if (userByUsername) {
      console.log(`⚠️  Found user with email as username: ${userByUsername.id}`);
      console.log(`   Email: ${userByUsername.email}`);
      console.log(`   Username: ${userByUsername.username}`);
      console.log(`   Role: ${userByUsername.role}`);
      
      // Update the username to be unique
      const newUsername = `USER-${userByUsername.id.slice(0, 8)}`;
      const { error: updateError } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', userByUsername.id);

      if (updateError) {
        console.error('❌ Failed to update username:', updateError.message);
      } else {
        console.log(`✅ Updated username to: ${newUsername}`);
      }
    }

    // Check if the email exists as an email
    const { data: userByEmail, error: emailError } = await supabase
      .from('users')
      .select('*')
      .eq('email', problemEmail)
      .single();

    if (emailError && emailError.code !== 'PGRST116') {
      console.error('Error checking email:', emailError.message);
      return;
    }

    if (userByEmail) {
      console.log(`ℹ️  Found user with email: ${userByEmail.id}`);
      console.log(`   Email: ${userByEmail.email}`);
      console.log(`   Username: ${userByEmail.username}`);
      console.log(`   Role: ${userByEmail.role}`);
    }

    // Check for any other potential conflicts
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email, username, role')
      .or(`email.eq.${problemEmail},username.eq.${problemEmail}`);

    if (allUsersError) {
      console.error('Error checking all users:', allUsersError.message);
      return;
    }

    console.log(`\n📊 Found ${allUsers.length} users related to ${problemEmail}:`);
    allUsers.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Username: ${user.username}, Role: ${user.role}`);
    });

    console.log('\n✅ Username conflict check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixDuplicateUsername();
