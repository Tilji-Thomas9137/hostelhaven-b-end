# 🏠 Admin-Managed Room Assignment System

## 📋 **Overview**

This system provides complete admin control over room assignments, check-ins, checkouts, and transfers. All room management operations are handled by administrators, operations staff, and wardens.

## 🔗 **User Table Integration**

### **How It Connects to Users Table:**

```sql
-- Users table structure
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    room_id UUID REFERENCES rooms(id), -- Direct room assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Key Relationships:**
- `users.room_id` → `rooms.id` (Direct room assignment)
- `room_allocations.user_id` → `users.id` (Allocation history)
- `room_allocations.allocated_by` → `users.id` (Who assigned the room)

## 🎯 **Admin-Managed Workflow**

### **1. Room Assignment Process**
```
Admin → Selects Student → Selects Room → Assigns Room → Updates Records
```

### **2. Check-in Process**
```
Student Arrives → Admin Verifies → Assigns Room → Updates Occupancy
```

### **3. Checkout Process**
```
Student Leaves → Admin Processes → Removes Assignment → Updates Occupancy
```

### **4. Room Transfer Process**
```
Admin → Selects Student → Selects New Room → Transfers → Updates All Records
```

## 🚀 **API Endpoints**

### **Room Assignment**
- `POST /api/admin/room-assignment/assign` - Assign room to student
- `GET /api/admin/room-assignment/assignments` - Get all assignments
- `GET /api/admin/room-assignment/room-occupancy` - Get room occupancy details

### **Check-in/Checkout**
- `POST /api/admin/room-assignment/checkout` - Process student checkout

### **Room Transfers**
- `POST /api/admin/room-assignment/transfer` - Transfer student to new room

### **Statistics & Monitoring**
- `GET /api/admin/room-assignment/statistics` - Get assignment statistics

## 📊 **Usage Examples**

### **1. Assign Room to Student**
```bash
POST /api/admin/room-assignment/assign
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "room_id": "987fcdeb-51a2-43d7-8f9e-123456789abc",
  "allocation_type": "manual",
  "notes": "New student check-in"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room assigned successfully",
  "data": {
    "allocation": {
      "id": "allocation-id",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "room_id": "987fcdeb-51a2-43d7-8f9e-123456789abc",
      "allocated_at": "2024-01-15T10:30:00Z",
      "allocation_type": "manual"
    },
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "full_name": "John Doe",
      "email": "john@example.com"
    },
    "room": {
      "id": "987fcdeb-51a2-43d7-8f9e-123456789abc",
      "room_number": "101"
    }
  }
}
```

### **2. Process Student Checkout**
```bash
POST /api/admin/room-assignment/checkout
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "reason": "End of semester",
  "notes": "Student completed studies"
}
```

### **3. Transfer Student to New Room**
```bash
POST /api/admin/room-assignment/transfer
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "new_room_id": "456fcdeb-51a2-43d7-8f9e-987654321def",
  "reason": "Room maintenance",
  "notes": "Temporary transfer due to AC repair"
}
```

### **4. Get Room Occupancy Details**
```bash
GET /api/admin/room-assignment/room-occupancy?room_id=987fcdeb-51a2-43d7-8f9e-123456789abc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "987fcdeb-51a2-43d7-8f9e-123456789abc",
      "room_number": "101",
      "room_type": "standard",
      "floor": 1,
      "capacity": 2,
      "occupied": 1,
      "status": "available",
      "current_occupants": [
        {
          "user": {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "full_name": "John Doe",
            "email": "john@example.com",
            "phone": "+1234567890",
            "role": "student"
          }
        }
      ]
    }
  }
}
```

## 🔄 **What Happens During Assignment**

### **When Admin Assigns Room:**

1. **Validates User & Room:**
   - Checks if user exists
   - Verifies user doesn't already have a room
   - Confirms room exists and has capacity

2. **Updates User Record:**
   ```sql
   UPDATE users SET room_id = 'new-room-id' WHERE id = 'user-id'
   ```

3. **Updates Room Occupancy:**
   ```sql
   UPDATE rooms SET 
     occupied = occupied + 1,
     status = CASE WHEN (occupied + 1) >= capacity THEN 'occupied' ELSE 'available' END
   WHERE id = 'room-id'
   ```

4. **Creates Allocation Record:**
   ```sql
   INSERT INTO room_allocations (
     user_id, room_id, allocated_by, allocation_type, notes
   ) VALUES (...)
   ```

5. **Updates Room Request (if exists):**
   ```sql
   UPDATE room_requests SET 
     status = 'allocated',
     allocated_room_id = 'room-id',
     allocated_at = NOW(),
     allocated_by = 'admin-id'
   WHERE user_id = 'user-id'
   ```

## 🏠 **Room Status Management**

### **Room Statuses:**
- `available` - Room has space and is ready for assignment
- `occupied` - Room is at full capacity
- `maintenance` - Room is under repair/cleaning
- `reserved` - Room is booked but not yet occupied

### **Automatic Status Updates:**
- When `occupied >= capacity` → Status becomes `occupied`
- When `occupied < capacity` → Status becomes `available`
- Admin can manually set `maintenance` or `reserved`

## 👥 **Role-Based Access**

### **Admin (`admin`):**
- Full access to all room management functions
- Can assign, transfer, and checkout any student
- Can view all statistics and reports

### **Hostel Operations Assistant (`hostel_operations_assistant`):**
- Can manage room assignments
- Can process check-ins and checkouts
- Can view occupancy reports

### **Warden (`warden`):**
- Can view room assignments and occupancy
- Can process checkouts
- Limited assignment capabilities

### **Students (`student`):**
- Can only view their own room assignment
- Cannot request room changes (admin-managed)

## 📈 **Statistics & Monitoring**

### **Room Statistics:**
```json
{
  "rooms": {
    "total": 100,
    "total_capacity": 200,
    "total_occupied": 150,
    "available": 25,
    "occupancy_rate": "75.00"
  },
  "allocations": {
    "active": 150,
    "ended": 50,
    "manual": 120,
    "automatic": 80,
    "total": 200
  }
}
```

## 🛡️ **Data Integrity & Safety**

### **Transaction-like Operations:**
- All assignment operations are atomic
- If any step fails, the operation is rolled back
- Comprehensive error handling and logging

### **Validation Checks:**
- User existence and current room status
- Room availability and capacity
- Role-based permission verification
- Data consistency validation

### **Audit Trail:**
- Complete history of all room assignments
- Who assigned what room and when
- Transfer and checkout history
- Notes and reasons for all operations

## 🚀 **Setup Instructions**

1. **Add the route to your server:**
   ```javascript
   const adminRoomManagement = require('./admin-room-management');
   app.use('/api/admin/room-assignment', adminRoomManagement);
   ```

2. **Ensure your database has the required tables:**
   - `users` (with `room_id` field)
   - `rooms`
   - `room_allocations`
   - `room_requests` (optional, for request tracking)

3. **Test the system:**
   - Create some rooms
   - Assign rooms to students
   - Test transfers and checkouts
   - Monitor statistics

## 🎯 **Benefits of Admin-Managed System**

✅ **Complete Control** - Admins have full control over all room assignments
✅ **Flexible Assignment** - Can assign rooms based on any criteria
✅ **Immediate Processing** - No waiting for batch processes
✅ **Audit Trail** - Complete history of all assignments
✅ **Emergency Handling** - Can quickly reassign rooms for emergencies
✅ **Custom Logic** - Can implement any assignment logic as needed
✅ **Real-time Updates** - Immediate occupancy and status updates
✅ **Role-based Access** - Different permission levels for different staff

This system gives you complete administrative control over room assignments while maintaining data integrity and providing comprehensive tracking of all operations!


