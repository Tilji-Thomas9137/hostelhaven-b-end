#!/usr/bin/env node

/**
 * Seed Clean Test Data for HostelHaven (Fixed Schema Version)
 * Creates minimal test users directly in the database with correct column names
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
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

async function seedCleanData() {
  console.log('🌱 Seeding Clean HostelHaven Test Data (Fixed Schema)');
  console.log('====================================================\n');

  try {
    // 1. Seed admission registry (correct column names)
    console.log('📋 Seeding admission registry...');
    const { error: admissionError } = await supabase
      .from('admission_registry')
      .upsert({
        admission_number: 'TEST001',
        student_name: 'Test Student',
        course: 'Computer Science',
        batch_year: 2024,
        parent_name: 'Test Parent',
        parent_email: 'parent@test.com',
        parent_phone: '+919876543210'
      });

    if (admissionError) {
      console.error('❌ Admission registry error:', admissionError);
    } else {
      console.log('✅ Admission registry seeded');
    }

    // 2. Seed staff users (with proper UUIDs)
    console.log('\n👥 Seeding staff users...');
    
    const staffUsers = [
      {
        id: uuidv4(),
        email: 'admin@test.com',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        full_name: 'Test Admin',
        role: 'admin',
        auth_uid: uuidv4()
      },
      {
        id: uuidv4(),
        email: 'warden@test.com',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        full_name: 'Test Warden',
        role: 'warden',
        auth_uid: uuidv4()
      },
      {
        id: uuidv4(),
        email: 'ops@test.com',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        full_name: 'Test Operations',
        role: 'hostel_operations_assistant',
        auth_uid: uuidv4()
      }
    ];

    for (const user of staffUsers) {
      const { error } = await supabase
        .from('users')
        .upsert(user);
      
      if (error) {
        console.error(`❌ Error seeding ${user.email}:`, error);
      } else {
        console.log(`✅ Seeded ${user.email} (${user.role})`);
      }
    }

    // 3. Seed student user
    console.log('\n🎓 Seeding student user...');
    const studentId = uuidv4();
    const studentAuthUid = uuidv4();
    
    const { error: studentError } = await supabase
      .from('users')
      .upsert({
        id: studentId,
        email: 'student@test.com',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        full_name: 'Test Student',
        role: 'student',
        auth_uid: studentAuthUid
      });

    if (studentError) {
      console.error('❌ Student user error:', studentError);
    } else {
      console.log('✅ Seeded student@test.com');
    }

    // 4. Seed student profile (correct column names)
    console.log('\n📝 Seeding student profile...');
    const profileId = uuidv4();
    
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: profileId,
        user_id: studentId,
        admission_number: 'TEST001',
        course: 'Computer Science',
        batch_year: 2024,
        date_of_birth: '2000-01-15',
        gender: 'male',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        country: 'India',
        emergency_contact_name: 'Test Parent',
        emergency_contact_phone: '+919876543210',
        parent_name: 'Test Parent',
        parent_phone: '+919876543210',
        parent_email: 'parent@test.com',
        aadhar_number: '123456789012',
        blood_group: 'O+',
        admission_number_verified: true,
        parent_contact_locked: true
      });

    if (profileError) {
      console.error('❌ Student profile error:', profileError);
    } else {
      console.log('✅ Seeded student profile');
    }

    // 5. Seed parent user
    console.log('\n👨‍👩‍👧‍👦 Seeding parent user...');
    const parentId = uuidv4();
    const parentAuthUid = uuidv4();
    
    const { error: parentUserError } = await supabase
      .from('users')
      .upsert({
        id: parentId,
        email: 'parent@test.com',
        password_hash: '$2a$10$placeholder.hash.for.supabase.auth',
        full_name: 'Test Parent',
        role: 'parent',
        auth_uid: parentAuthUid
      });

    if (parentUserError) {
      console.error('❌ Parent user error:', parentUserError);
    } else {
      console.log('✅ Seeded parent@test.com');
    }

    // 6. Seed parent profile (correct column names - no full_name column)
    console.log('\n👪 Seeding parent profile...');
    const parentProfileId = uuidv4();
    
    const { error: parentProfileError } = await supabase
      .from('parents')
      .upsert({
        id: parentProfileId,
        user_id: parentId,
        student_profile_id: profileId,
        email: 'parent@test.com',
        phone: '+919876543210',
        verified: true
      });

    if (parentProfileError) {
      console.error('❌ Parent profile error:', parentProfileError);
    } else {
      console.log('✅ Seeded parent profile');
    }

    // 7. Seed rooms (correct column names - no rent_amount, use price)
    console.log('\n🏠 Seeding rooms...');
    const rooms = [
      {
        id: uuidv4(),
        room_number: 'S101',
        floor: 1,
        room_type: 'single',
        capacity: 1,
        current_occupancy: 0,
        price: 500.00,
        status: 'available',
        amenities: ['WiFi', 'Air Conditioning', 'Private Bathroom'],
        room_code: 'S101'
      },
      {
        id: uuidv4(),
        room_number: 'D201',
        floor: 2,
        room_type: 'double',
        capacity: 2,
        current_occupancy: 0,
        price: 400.00,
        status: 'available',
        amenities: ['WiFi', 'Air Conditioning', 'Shared Bathroom'],
        room_code: 'D201'
      },
      {
        id: uuidv4(),
        room_number: 'T301',
        floor: 3,
        room_type: 'triple',
        capacity: 3,
        current_occupancy: 0,
        price: 300.00,
        status: 'available',
        amenities: ['WiFi', 'Fan', 'Shared Bathroom'],
        room_code: 'T301'
      }
    ];

    for (const room of rooms) {
      const { error } = await supabase
        .from('rooms')
        .upsert(room);
      
      if (error) {
        console.error(`❌ Error seeding room ${room.room_number}:`, error);
      } else {
        console.log(`✅ Seeded room ${room.room_number} (${room.room_type})`);
      }
    }

    console.log('\n🎉 Clean test data seeded successfully!');
    console.log('\n🔐 Test Credentials:');
    console.log('===================');
    console.log('Admin: admin@test.com / Test123!');
    console.log('Warden: warden@test.com / Test123!');
    console.log('Operations: ops@test.com / Test123!');
    console.log('Student: student@test.com / Test123!');
    console.log('Parent: parent@test.com / Test123!');
    console.log('\n📋 Test Data Summary:');
    console.log('====================');
    console.log('• Admission: TEST001 - Test Student');
    console.log('• Rooms: S101 (Single), D201 (Double), T301 (Triple)');
    console.log('• All rooms are available (0 occupancy)');
    console.log('• Parent is verified and linked to student');
    console.log('\n🧪 Next Steps:');
    console.log('1. Run: node scripts/setup-clean-test-users.js');
    console.log('2. Start backend: node server.js');
    console.log('3. Start frontend: npm run dev');
    console.log('4. Go to http://localhost:5173/login');
    console.log('5. Test each role with the credentials above');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedCleanData()
    .then(() => {
      console.log('\n✅ Seeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedCleanData };
