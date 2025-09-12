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
    // 1. Create the room allocation schema
    console.log('📋 Creating room allocation tables...');
    
    const schemaSQL = `
-- Complete Room Allocation System Schema
-- Based on the workflow: Admin adds rooms → Students request → Batch allocation → Waitlist handling

-- 1. ROOMS TABLE (Admin manages rooms)
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
    
    -- Ensure occupied doesn't exceed capacity
    CONSTRAINT check_occupancy CHECK (occupied <= capacity)
);

-- 2. ROOM REQUESTS TABLE (Students request room allocation)
CREATE TABLE IF NOT EXISTS room_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'waitlisted', 'cancelled', 'expired')),
    priority_score INTEGER DEFAULT 0, -- Higher score = higher priority
    preferred_room_type VARCHAR(50),
    preferred_floor INTEGER,
    special_requirements TEXT,
    allocated_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    allocated_at TIMESTAMP WITH TIME ZONE,
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waitlist_position INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-expire old requests
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ROOM ALLOCATIONS TABLE (Track allocation history)
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

-- 4. WAITLIST TABLE (Track waitlisted students)
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

-- 5. ALLOCATION BATCHES TABLE (Track batch allocation runs)
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
`;

    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });
    if (schemaError) {
      console.error('❌ Error creating schema:', schemaError);
      throw schemaError;
    }
    console.log('✅ Room allocation tables created successfully');

    // 2. Create indexes
    console.log('📊 Creating indexes...');
    
    const indexesSQL = `
-- INDEXES FOR PERFORMANCE
-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor);
CREATE INDEX IF NOT EXISTS idx_rooms_capacity_occupied ON rooms(capacity, occupied);

-- Room requests indexes
CREATE INDEX IF NOT EXISTS idx_room_requests_user_id ON room_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_requests_priority ON room_requests(priority_score DESC, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_room_requests_allocated_room ON room_requests(allocated_room_id);
CREATE INDEX IF NOT EXISTS idx_room_requests_expires ON room_requests(expires_at);

-- Room allocations indexes
CREATE INDEX IF NOT EXISTS idx_room_allocations_user_id ON room_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room_id ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_status ON room_allocations(status);
CREATE INDEX IF NOT EXISTS idx_room_allocations_active ON room_allocations(user_id, status) WHERE status = 'active';

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_room_waitlist_user_id ON room_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_room_waitlist_position ON room_waitlist(position);
CREATE INDEX IF NOT EXISTS idx_room_waitlist_priority ON room_waitlist(priority_score DESC, added_at ASC);
`;

    const { error: indexesError } = await supabase.rpc('exec_sql', { sql: indexesSQL });
    if (indexesError) {
      console.error('❌ Error creating indexes:', indexesError);
      throw indexesError;
    }
    console.log('✅ Indexes created successfully');

    // 3. Enable RLS and create policies
    console.log('🔒 Setting up Row Level Security...');
    
    const rlsSQL = `
-- ENABLE ROW LEVEL SECURITY
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_batches ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Rooms: Anyone can view, only admins can manage
CREATE POLICY "Anyone can view rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage rooms" ON rooms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Room requests: Users can manage their own, admins can manage all
CREATE POLICY "Users can view their own requests" ON room_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" ON room_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own requests" ON room_requests
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all requests" ON room_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Room allocations: Users can view their own, admins can manage all
CREATE POLICY "Users can view their own allocations" ON room_allocations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all allocations" ON room_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Waitlist: Users can view their own, admins can manage all
CREATE POLICY "Users can view their own waitlist" ON room_waitlist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all waitlist" ON room_waitlist
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );

-- Allocation batches: Only admins can manage
CREATE POLICY "Admins can manage allocation batches" ON allocation_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'hostel_operations_assistant')
        )
    );
`;

    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: rlsSQL });
    if (rlsError) {
      console.error('❌ Error setting up RLS:', rlsError);
      throw rlsError;
    }
    console.log('✅ Row Level Security configured successfully');

    // 4. Create triggers
    console.log('⚡ Creating triggers...');
    
    const triggersSQL = `
-- TRIGGERS FOR UPDATING TIMESTAMPS
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_requests_updated_at BEFORE UPDATE ON room_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_allocations_updated_at BEFORE UPDATE ON room_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_waitlist_updated_at BEFORE UPDATE ON room_waitlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

    const { error: triggersError } = await supabase.rpc('exec_sql', { sql: triggersSQL });
    if (triggersError) {
      console.error('❌ Error creating triggers:', triggersError);
      throw triggersError;
    }
    console.log('✅ Triggers created successfully');

    // 5. Create functions
    console.log('🔧 Creating allocation functions...');
    
    const functionsSQL = `
-- FUNCTIONS FOR ROOM ALLOCATION LOGIC

-- Function to calculate priority score for a student
CREATE OR REPLACE FUNCTION calculate_priority_score(
    user_id UUID,
    requested_at TIMESTAMP WITH TIME ZONE
) RETURNS INTEGER AS $$
DECLARE
    user_role VARCHAR(50);
    user_created_at TIMESTAMP WITH TIME ZONE;
    score INTEGER := 0;
BEGIN
    -- Get user details
    SELECT role, created_at INTO user_role, user_created_at
    FROM users WHERE id = user_id;
    
    -- Base score from request time (earlier = higher score)
    score := EXTRACT(EPOCH FROM (NOW() - requested_at))::INTEGER;
    
    -- Role-based priority
    CASE user_role
        WHEN 'admin' THEN score := score + 10000;
        WHEN 'warden' THEN score := score + 8000;
        WHEN 'hostel_operations_assistant' THEN score := score + 6000;
        WHEN 'student' THEN score := score + 1000;
        ELSE score := score + 500;
    END CASE;
    
    -- Seniority bonus (older accounts get priority)
    score := score + EXTRACT(EPOCH FROM (NOW() - user_created_at))::INTEGER / 86400; -- Days since account creation
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to find available rooms
CREATE OR REPLACE FUNCTION find_available_rooms(
    preferred_room_type VARCHAR(50) DEFAULT NULL,
    preferred_floor INTEGER DEFAULT NULL
) RETURNS TABLE(
    room_id UUID,
    room_number VARCHAR(20),
    room_type VARCHAR(50),
    floor INTEGER,
    capacity INTEGER,
    occupied INTEGER,
    available_spots INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.room_number,
        r.room_type,
        r.floor,
        r.capacity,
        r.occupied,
        (r.capacity - r.occupied) as available_spots
    FROM rooms r
    WHERE r.status = 'available'
    AND r.occupied < r.capacity
    AND (preferred_room_type IS NULL OR r.room_type = preferred_room_type)
    AND (preferred_floor IS NULL OR r.floor = preferred_floor)
    ORDER BY 
        CASE WHEN preferred_room_type IS NOT NULL AND r.room_type = preferred_room_type THEN 0 ELSE 1 END,
        CASE WHEN preferred_floor IS NOT NULL AND r.floor = preferred_floor THEN 0 ELSE 1 END,
        r.room_number;
END;
$$ LANGUAGE plpgsql;

-- Function to run batch allocation
CREATE OR REPLACE FUNCTION run_batch_allocation(
    batch_name VARCHAR(100) DEFAULT 'Auto Allocation',
    run_by_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    batch_id UUID;
    request_record RECORD;
    room_record RECORD;
    allocated_count INTEGER := 0;
    waitlisted_count INTEGER := 0;
    total_requests INTEGER := 0;
    errors TEXT[] := '{}';
BEGIN
    -- Create batch record
    INSERT INTO allocation_batches (batch_name, run_by, status)
    VALUES (batch_name, run_by_user_id, 'running')
    RETURNING id INTO batch_id;
    
    -- Get total pending requests
    SELECT COUNT(*) INTO total_requests
    FROM room_requests 
    WHERE status = 'pending';
    
    -- Update batch with total requests
    UPDATE allocation_batches 
    SET total_requests = total_requests
    WHERE id = batch_id;
    
    -- Process requests in priority order
    FOR request_record IN
        SELECT 
            rr.*,
            calculate_priority_score(rr.user_id, rr.requested_at) as calculated_priority
        FROM room_requests rr
        WHERE rr.status = 'pending'
        AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
        ORDER BY calculated_priority DESC, rr.requested_at ASC
    LOOP
        -- Update priority score
        UPDATE room_requests 
        SET priority_score = request_record.calculated_priority
        WHERE id = request_record.id;
        
        -- Find available room
        SELECT * INTO room_record
        FROM find_available_rooms(
            request_record.preferred_room_type,
            request_record.preferred_floor
        )
        LIMIT 1;
        
        IF room_record.room_id IS NOT NULL THEN
            -- Allocate room
            BEGIN
                -- Update room occupancy
                UPDATE rooms 
                SET occupied = occupied + 1,
                    status = CASE 
                        WHEN (occupied + 1) >= capacity THEN 'occupied'
                        ELSE 'available'
                    END
                WHERE id = room_record.room_id;
                
                -- Update user's room_id
                UPDATE users 
                SET room_id = room_record.room_id
                WHERE id = request_record.user_id;
                
                -- Update request status
                UPDATE room_requests 
                SET 
                    status = 'allocated',
                    allocated_room_id = room_record.room_id,
                    allocated_at = NOW(),
                    allocated_by = run_by_user_id
                WHERE id = request_record.id;
                
                -- Create allocation record
                INSERT INTO room_allocations (
                    user_id, room_id, allocated_by, allocation_type
                ) VALUES (
                    request_record.user_id, 
                    room_record.room_id, 
                    run_by_user_id, 
                    'automatic'
                );
                
                allocated_count := allocated_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                errors := array_append(errors, 
                    'Failed to allocate room ' || room_record.room_number || 
                    ' to user ' || request_record.user_id || ': ' || SQLERRM
                );
            END;
        ELSE
            -- No room available, add to waitlist
            UPDATE room_requests 
            SET status = 'waitlisted'
            WHERE id = request_record.id;
            
            -- Add to waitlist
            INSERT INTO room_waitlist (
                user_id, room_request_id, position, preferred_room_type, priority_score
            ) VALUES (
                request_record.user_id,
                request_record.id,
                (SELECT COALESCE(MAX(position), 0) + 1 FROM room_waitlist),
                request_record.preferred_room_type,
                request_record.calculated_priority
            );
            
            waitlisted_count := waitlisted_count + 1;
        END IF;
    END LOOP;
    
    -- Update batch completion
    UPDATE allocation_batches 
    SET 
        status = 'completed',
        completed_at = NOW(),
        allocated_count = allocated_count,
        waitlisted_count = waitlisted_count,
        errors = errors
    WHERE id = batch_id;
    
    RETURN batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process waitlist when rooms become available
CREATE OR REPLACE FUNCTION process_waitlist() RETURNS INTEGER AS $$
DECLARE
    waitlist_record RECORD;
    room_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- Process waitlist in priority order
    FOR waitlist_record IN
        SELECT 
            rw.*,
            rr.user_id,
            rr.preferred_room_type,
            rr.preferred_floor
        FROM room_waitlist rw
        JOIN room_requests rr ON rw.room_request_id = rr.id
        WHERE rr.status = 'waitlisted'
        AND (rw.expires_at IS NULL OR rw.expires_at > NOW())
        ORDER BY rw.priority_score DESC, rw.added_at ASC
    LOOP
        -- Find available room
        SELECT * INTO room_record
        FROM find_available_rooms(
            waitlist_record.preferred_room_type,
            waitlist_record.preferred_floor
        )
        LIMIT 1;
        
        IF room_record.room_id IS NOT NULL THEN
            -- Allocate room to waitlisted user
            BEGIN
                -- Update room occupancy
                UPDATE rooms 
                SET occupied = occupied + 1,
                    status = CASE 
                        WHEN (occupied + 1) >= capacity THEN 'occupied'
                        ELSE 'available'
                    END
                WHERE id = room_record.room_id;
                
                -- Update user's room_id
                UPDATE users 
                SET room_id = room_record.room_id
                WHERE id = waitlist_record.user_id;
                
                -- Update request status
                UPDATE room_requests 
                SET 
                    status = 'allocated',
                    allocated_room_id = room_record.room_id,
                    allocated_at = NOW()
                WHERE id = waitlist_record.room_request_id;
                
                -- Create allocation record
                INSERT INTO room_allocations (
                    user_id, room_id, allocation_type
                ) VALUES (
                    waitlist_record.user_id, 
                    room_record.room_id, 
                    'automatic'
                );
                
                -- Remove from waitlist
                DELETE FROM room_waitlist 
                WHERE id = waitlist_record.id;
                
                processed_count := processed_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                -- Log error but continue processing
                RAISE NOTICE 'Failed to process waitlist entry %: %', waitlist_record.id, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;
`;

    const { error: functionsError } = await supabase.rpc('exec_sql', { sql: functionsSQL });
    if (functionsError) {
      console.error('❌ Error creating functions:', functionsError);
      throw functionsError;
    }
    console.log('✅ Allocation functions created successfully');

    // 6. Create sample rooms
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
    console.log('   ✅ 5 database tables (rooms, room_requests, room_allocations, room_waitlist, allocation_batches)');
    console.log('   ✅ Performance indexes');
    console.log('   ✅ Row Level Security policies');
    console.log('   ✅ Update triggers');
    console.log('   ✅ Allocation functions (priority calculation, batch allocation, waitlist processing)');
    console.log('   ✅ Sample rooms');
    console.log('\n🚀 You can now:');
    console.log('   1. Add more rooms via the admin dashboard');
    console.log('   2. Students can request room allocation');
    console.log('   3. Run batch allocation to assign rooms');
    console.log('   4. Process waitlist when rooms become available');
    console.log('\n📚 API endpoints available:');
    console.log('   • POST /api/room-allocation/rooms - Add rooms');
    console.log('   • POST /api/room-allocation/request - Request room');
    console.log('   • POST /api/room-allocation/batch-allocate - Run allocation');
    console.log('   • POST /api/room-allocation/process-waitlist - Process waitlist');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupRoomAllocationSystem();


