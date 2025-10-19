const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'sql', 'setup-database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL file loaded successfully');
    
    // Execute the SQL
    console.log('⚡ Executing SQL commands...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error executing SQL:', error);
      
      // Try alternative approach - execute SQL directly
      console.log('🔄 Trying alternative approach...');
      const { error: altError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .limit(1);
      
      if (altError) {
        console.error('❌ Database connection failed:', altError);
        console.log('\n📋 Manual Setup Instructions:');
        console.log('1. Open your Supabase dashboard');
        console.log('2. Go to SQL Editor');
        console.log('3. Copy and paste the contents of sql/setup-database.sql');
        console.log('4. Execute the SQL');
        console.log('5. Restart your backend server');
      }
    } else {
      console.log('✅ Database setup completed successfully!');
      console.log('📊 Setup results:', data);
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.log('\n📋 Manual Setup Instructions:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste the contents of sql/setup-database.sql');
    console.log('4. Execute the SQL');
    console.log('5. Restart your backend server');
  }
}

// Run the setup
setupDatabase();
