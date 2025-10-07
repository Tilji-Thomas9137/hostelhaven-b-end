const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration!');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function activateStudent() {
  console.log('🔧 Activating student account...');
  
  try {
    // Find the student by email
    const { data: student, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'aswinmurali2026@mca.ajce.in')
      .single();

    if (fetchError || !student) {
      console.error('❌ Student not found:', fetchError);
      return;
    }

    console.log('📋 Found student:', {
      id: student.id,
      email: student.email,
      full_name: student.full_name,
      role: student.role,
      status: student.status,
      auth_uid: student.auth_uid
    });

    // Update the student status to 'available'
    const { data: updatedStudent, error: updateError } = await supabase
      .from('users')
      .update({
        status: 'available',
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to activate student:', updateError);
      return;
    }

    console.log('✅ Student activated successfully!');
    console.log('📋 Updated student:', {
      id: updatedStudent.id,
      email: updatedStudent.email,
      status: updatedStudent.status
    });

  } catch (error) {
    console.error('❌ Error activating student:', error);
  }
}

activateStudent();
