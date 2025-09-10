const { supabase } = require('../config/supabase');

async function seedData() {
  try {
    console.log('Starting data seeding...');

    // Create admin user if it doesn't exist
    const { data: existingAdmin, error: adminCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@hostelhaven.com')
      .single();

    if (!existingAdmin) {
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .insert({
          email: 'admin@hostelhaven.com',
          full_name: 'System Administrator',
          role: 'admin',
          phone: '+1-555-0000'
        })
        .select()
        .single();

      if (adminError) {
        console.error('Error creating admin user:', adminError);
      } else {
        console.log('Created admin user:', adminUser.email);
      }
    }

    // Create sample hostels
    const { data: hostels, error: hostelError } = await supabase
      .from('hostels')
      .insert([
        {
          name: 'University Heights Hostel',
          address: '123 University Ave',
          city: 'New York',
          state: 'NY',
          country: 'USA',
          postal_code: '10001',
          phone: '+1-555-0123',
          email: 'contact@universityhostel.com',
          capacity: 200,
          occupancy: 150
        },
        {
          name: 'Downtown Student Residence',
          address: '456 Downtown St',
          city: 'Los Angeles',
          state: 'CA',
          country: 'USA',
          postal_code: '90001',
          phone: '+1-555-0456',
          email: 'info@downtownresidence.com',
          capacity: 150,
          occupancy: 120
        }
      ])
      .select();

    if (hostelError) {
      console.error('Error creating hostels:', hostelError);
      return;
    }

    console.log('Created hostels:', hostels.length);

    // Create sample rooms
    const rooms = [];
    hostels.forEach(hostel => {
      for (let floor = 1; floor <= 5; floor++) {
        for (let roomNum = 1; roomNum <= 10; roomNum++) {
          const roomNumber = `${floor}${roomNum.toString().padStart(2, '0')}`;
          rooms.push({
            hostel_id: hostel.id,
            room_number: roomNumber,
            floor: floor,
            room_type: roomNum <= 5 ? 'standard' : 'deluxe',
            capacity: roomNum <= 3 ? 1 : 2,
            occupied: Math.random() > 0.3 ? (roomNum <= 3 ? 1 : Math.floor(Math.random() * 2) + 1) : 0,
            price: roomNum <= 3 ? 800 : (roomNum <= 5 ? 1000 : 1200),
            status: Math.random() > 0.2 ? 'occupied' : 'available'
          });
        }
      }
    });

    const { data: createdRooms, error: roomError } = await supabase
      .from('rooms')
      .insert(rooms)
      .select();

    if (roomError) {
      console.error('Error creating rooms:', roomError);
      return;
    }

    console.log('Created rooms:', createdRooms.length);

    // Create sample payments for existing users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, hostel_id, room_id')
      .eq('role', 'student');

    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }

    if (users.length > 0) {
      const payments = [];
      const currentDate = new Date();
      
      users.forEach(user => {
        if (user.room_id) {
          // Create payments for last 6 months
          for (let i = 0; i < 6; i++) {
            const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 15);
            const isPaid = i > 0 || Math.random() > 0.3; // Current month might be unpaid
            
            payments.push({
              user_id: user.id,
              hostel_id: user.hostel_id,
              room_id: user.room_id,
              amount: 1200,
              payment_type: 'monthly_rent',
              status: isPaid ? 'paid' : 'pending',
              due_date: dueDate.toISOString().split('T')[0],
              paid_date: isPaid ? new Date(dueDate.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
              month_year: `${dueDate.getFullYear()}-${(dueDate.getMonth() + 1).toString().padStart(2, '0')}`,
              description: `Monthly rent for ${dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              transaction_id: isPaid ? `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null
            });
          }
        }
      });

      const { data: createdPayments, error: paymentError } = await supabase
        .from('payments')
        .insert(payments)
        .select();

      if (paymentError) {
        console.error('Error creating payments:', paymentError);
      } else {
        console.log('Created payments:', createdPayments.length);
      }

      // Create sample complaints
      const complaints = [];
      const complaintTitles = [
        'WiFi connection is very slow',
        'Air conditioning not working',
        'Noisy neighbors',
        'Bathroom needs cleaning',
        'Hot water not available',
        'Room heater malfunction',
        'Broken window lock',
        'Pest control needed'
      ];

      users.slice(0, Math.min(users.length, 5)).forEach((user, index) => {
        if (user.room_id) {
          complaints.push({
            user_id: user.id,
            hostel_id: user.hostel_id,
            room_id: user.room_id,
            title: complaintTitles[index % complaintTitles.length],
            description: `Detailed description of the ${complaintTitles[index % complaintTitles.length].toLowerCase()} issue.`,
            category: ['wifi', 'maintenance', 'noise', 'cleanliness', 'maintenance', 'maintenance', 'security', 'maintenance'][index % 8],
            priority: ['medium', 'high', 'low', 'medium', 'high', 'medium', 'high', 'medium'][index % 8],
            status: ['pending', 'in_progress', 'resolved', 'pending'][index % 4],
            resolved_at: index % 4 === 2 ? new Date().toISOString() : null
          });
        }
      });

      const { data: createdComplaints, error: complaintError } = await supabase
        .from('complaints')
        .insert(complaints)
        .select();

      if (complaintError) {
        console.error('Error creating complaints:', complaintError);
      } else {
        console.log('Created complaints:', createdComplaints.length);
      }

      // Create sample leave requests
      const leaveRequests = [];
      const leaveReasons = [
        'Family visit',
        'Medical appointment',
        'Job interview',
        'Wedding ceremony',
        'Emergency at home'
      ];

      users.slice(0, Math.min(users.length, 3)).forEach((user, index) => {
        if (user.room_id) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) + 1);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

          leaveRequests.push({
            user_id: user.id,
            hostel_id: user.hostel_id,
            room_id: user.room_id,
            reason: leaveReasons[index % leaveReasons.length],
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            emergency_contact: 'John Doe',
            emergency_phone: '+1-555-0789',
            status: ['pending', 'approved', 'pending'][index % 3]
          });
        }
      });

      const { data: createdLeaveRequests, error: leaveError } = await supabase
        .from('leave_requests')
        .insert(leaveRequests)
        .select();

      if (leaveError) {
        console.error('Error creating leave requests:', leaveError);
      } else {
        console.log('Created leave requests:', createdLeaveRequests.length);
      }
    }

    console.log('Data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

// Run the seeding function
seedData();