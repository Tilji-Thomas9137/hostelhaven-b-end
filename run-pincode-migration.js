const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPincodeColumn() {
  try {
    console.log('Adding pincode column to user_profiles table...');
    
    // Execute the SQL to add pincode column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_profiles' 
                AND column_name = 'pincode'
            ) THEN
                ALTER TABLE user_profiles ADD COLUMN pincode VARCHAR(10);
            END IF;
        END $$;
      `
    });

    if (error) {
      console.error('Error adding pincode column:', error);
      return;
    }

    console.log('✅ Pincode column added successfully to user_profiles table');
    
    // Add comment to the column
    await supabase.rpc('exec_sql', {
      sql: "COMMENT ON COLUMN user_profiles.pincode IS '6-digit postal code for address location';"
    });

    console.log('✅ Column comment added successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

addPincodeColumn();
