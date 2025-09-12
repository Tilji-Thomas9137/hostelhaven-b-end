require('dotenv').config({ path: './config.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addAmenitiesColumn() {
  try {
    console.log('🔧 Adding preferred_amenities column to room_requests table...');
    
    // First, let's check if the column already exists
    const { data: columns, error: columnError } = await supabase
      .from('room_requests')
      .select('preferred_amenities')
      .limit(1);
    
    if (columnError && columnError.code === 'PGRST116') {
      console.log('⚠️  Column does not exist, attempting to add it...');
      
      // Since we can't directly alter table structure via Supabase client,
      // we'll test if we can insert data with the column
      const { data: testInsert, error: insertError } = await supabase
        .from('room_requests')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // dummy ID
          preferred_amenities: ['WiFi', 'Air Conditioning']
        })
        .select();
      
      if (insertError) {
        console.log('❌ Column does not exist and cannot be added via API');
        console.log('📝 Please manually add the column using this SQL:');
        console.log('ALTER TABLE room_requests ADD COLUMN preferred_amenities TEXT[];');
        return;
      } else {
        console.log('✅ Column exists and is working!');
        // Clean up the test insert
        await supabase.from('room_requests').delete().eq('user_id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (columnError) {
      console.error('❌ Error checking column:', columnError);
      return;
    } else {
      console.log('✅ preferred_amenities column already exists!');
    }
    
    console.log('🎉 Database is ready for amenities functionality!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addAmenitiesColumn();
