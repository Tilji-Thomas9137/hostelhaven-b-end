// Debug student creation process
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugStudentCreation() {
  console.log('🔍 Debugging student creation process...');
  
  // Simulate the data from your form
  const testData = {
    admission_number: 'ADM2026001', // This might be the issue
    student_email: 'aswinmurali2026@mca.a',
    parent_email: 'tilji0119@gmail.com',
    parent_name: 'Muraleedharan'
  };

  console.log('📋 Test data:');
  console.log(`   Admission Number: ${testData.admission_number}`);
  console.log(`   Student Email: ${testData.student_email}`);
  console.log(`   Parent Email: ${testData.parent_email}`);
  console.log(`   Parent Name: ${testData.parent_name}`);

  try {
    // Check if student email exists
    const { data: existingStudent, error: studentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testData.student_email)
      .single();

    if (studentError && studentError.code !== 'PGRST116') {
      console.error('Error checking student:', studentError.message);
    } else if (existingStudent) {
      console.log(`⚠️  Student email already exists: ${existingStudent.id}`);
      console.log(`   Username: ${existingStudent.username}`);
    } else {
      console.log('✅ Student email is available');
    }

    // Check if parent email exists
    const { data: existingParent, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testData.parent_email)
      .single();

    if (parentError && parentError.code !== 'PGRST116') {
      console.error('Error checking parent:', parentError.message);
    } else if (existingParent) {
      console.log(`⚠️  Parent email already exists: ${existingParent.id}`);
      console.log(`   Username: ${existingParent.username}`);
    } else {
      console.log('✅ Parent email is available');
    }

    // Check if admission number exists as username
    const { data: existingAdmission, error: admissionError } = await supabase
      .from('users')
      .select('*')
      .eq('username', testData.admission_number)
      .single();

    if (admissionError && admissionError.code !== 'PGRST116') {
      console.error('Error checking admission number:', admissionError.message);
    } else if (existingAdmission) {
      console.log(`⚠️  Admission number already used as username: ${existingAdmission.id}`);
      console.log(`   Email: ${existingAdmission.email}`);
    } else {
      console.log('✅ Admission number is available as username');
    }

    // Check if parent username would conflict
    const parentUsername = `PARENT-${testData.admission_number}`;
    const { data: existingParentUsername, error: parentUsernameError } = await supabase
      .from('users')
      .select('*')
      .eq('username', parentUsername)
      .single();

    if (parentUsernameError && parentUsernameError.code !== 'PGRST116') {
      console.error('Error checking parent username:', parentUsernameError.message);
    } else if (existingParentUsername) {
      console.log(`⚠️  Parent username already exists: ${existingParentUsername.id}`);
      console.log(`   Email: ${existingParentUsername.email}`);
    } else {
      console.log(`✅ Parent username '${parentUsername}' is available`);
    }

    // Check admission registry
    const { data: admissionRecord, error: registryError } = await supabase
      .from('admission_registry')
      .select('*')
      .eq('admission_number', testData.admission_number)
      .single();

    if (registryError && registryError.code !== 'PGRST116') {
      console.error('Error checking admission registry:', registryError.message);
    } else if (admissionRecord) {
      console.log(`⚠️  Admission number already in registry: ${admissionRecord.id}`);
    } else {
      console.log('✅ Admission number is available in registry');
    }

    console.log('\n🎯 Summary:');
    console.log('If you see any ⚠️ warnings above, those are the conflicts causing the error.');
    console.log('The system should handle username conflicts automatically with the fix I implemented.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugStudentCreation();
