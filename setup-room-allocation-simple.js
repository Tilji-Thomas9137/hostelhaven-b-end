const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in config.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRoomAllocationSystem() {
  console.log('🏠 Setting up Room Allocation System...\n');

  try {
    // 1. Create the rooms table
    console.log('📋 Creating rooms table...');
    
    const { error: roomsError } = await supabase
      .from('rooms')
      .select('id')
      .limit(1);

    if (roomsError && roomsError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it
      console.log('⚠️  Rooms table does not exist. Please create it manually in Supabase SQL Editor:');
      console.log(`
-- Copy and paste this SQL in Supabase SQL Editor:

-- 1. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number VARCHAR(20) NOT NULL UNIQUE,
    floor INTEGER,
    room_type VARCHAR(50) DEFAULT 'standard' CHECK (room_type IN ('standard', 'deluxe', 'premium', 'suite')),
    capacity INTEGER DEFAULT 1 CHECK (capacity > 0),
    occupied INTEGER DEFAULT 0 CHECK (occupied >= 0),
    price DECIMAL(10,2) CHECK (price >= 0),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    amenities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_occupancy CHECK (occupied <= capacity)
);

-- 2. ROOM REQUESTS TABLE
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'waitlisted', 'cancelled', 'expired')),
    priority_score INTEGER DEFAULT 0,
    preferred_room_type VARCHAR(50),
    preferred_floor INTEGER,
    special_requirements TEXT,
    allocated_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    allocated_at TIMESTAMP WITH TIME ZONE,
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waitlist_position INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ROOM ALLOCATIONS TABLE
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    allocation_type VARCHAR(20) DEFAULT 'automatic' CHECK (allocation_type IN ('automatic', 'manual', 'transfer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'transferred')),
    ended_at TIMESTAMP WITH TIME ZONE,
    ended_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. WAITLIST TABLE
CREATE TABLE IF NOT EXISTS room_waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_request_id UUID NOT NULL REFERENCES room_requests(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    preferred_room_type VARCHAR(50),
    priority_score INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, room_request_id)
);

-- 5. ALLOCATION BATCHES TABLE
CREATE TABLE IF NOT EXISTS allocation_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_name VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_requests INTEGER DEFAULT 0,
    allocated_count INTEGER DEFAULT 0,
    waitlisted_count INTEGER DEFAULT 0,
    errors TEXT[],
    run_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_allocations_user_id ON room_allocations(user_id);

-- RLS POLICIES
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_batches ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Anyone can view rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Admins can manage rooms" ON rooms FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'hostel_operations_assistant'))
);

-- Room requests policies
CREATE POLICY "Users can view their own requests" ON room_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own requests" ON room_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own requests" ON room_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all requests" ON room_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'hostel_operations_assistant'))
);

-- Room allocations policies
CREATE POLICY "Users can view their own allocations" ON room_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all allocations" ON room_allocations FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'hostel_operations_assistant'))
);

-- Waitlist policies
CREATE POLICY "Users can view their own waitlist" ON room_waitlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all waitlist" ON room_waitlist FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'hostel_operations_assistant'))
);

-- Allocation batches policies
CREATE POLICY "Admins can manage allocation batches" ON allocation_batches FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'hostel_operations_assistant'))
);
      `);
      console.log('\n📝 After creating the tables, run this script again to add sample data.');
      return;
    }

    console.log('✅ Rooms table exists');

    // 2. Create sample rooms
    console.log('🏠 Creating sample rooms...');
    
    const sampleRooms = [
      { room_number: '101', floor: 1, room_type: 'standard', capacity: 2, price: 5000 },
      { room_number: '102', floor: 1, room_type: 'standard', capacity: 2, price: 5000 },
      { room_number: '103', floor: 1, room_type: 'deluxe', capacity: 1, price: 7500 },
      { room_number: '201', floor: 2, room_type: 'standard', capacity: 2, price: 5000 },
      { room_number: '202', floor: 2, room_type: 'standard', capacity: 2, price: 5000 },
      { room_number: '203', floor: 2, room_type: 'premium', capacity: 1, price: 10000 },
      { room_number: '301', floor: 3, room_type: 'standard', capacity: 2, price: 5000 },
      { room_number: '302', floor: 3, room_type: 'suite', capacity: 1, price: 15000 },
    ];

    for (const room of sampleRooms) {
      const { error: roomError } = await supabase
        .from('rooms')
        .insert(room);
      
      if (roomError) {
        console.log(`⚠️  Room ${room.room_number} might already exist: ${roomError.message}`);
      } else {
        console.log(`✅ Created room ${room.room_number}`);
      }
    }

    console.log('\n🎉 Room Allocation System setup completed successfully!');
    console.log('\n📋 What was created:');
    console.log('   ✅ Sample rooms for testing');
    console.log('\n🚀 You can now:');
    console.log('   1. Test the room allocation API endpoints');
    console.log('   2. Use the admin dashboard to manage rooms');
    console.log('   3. Students can request room allocation');
    console.log('\n📚 API endpoints available:');
    console.log('   • POST /api/room-allocation/rooms - Add rooms');
    console.log('   • POST /api/room-allocation/request - Request room');
    console.log('   • GET /api/room-allocation/rooms - Get all rooms');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupRoomAllocationSystem();


