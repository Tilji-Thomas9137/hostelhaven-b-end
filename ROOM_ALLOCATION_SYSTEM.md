# 🏠 Complete Room Allocation System

## 📋 **System Overview**

This is a comprehensive room allocation system that handles the complete workflow from room creation to student allocation, including waitlist management and batch processing.

## 🔄 **Workflow Process**

### 1. **Admin Adds Rooms**
- Admins create rooms with capacity, type, and pricing
- Rooms start with `occupied = 0` and `status = 'available'`

### 2. **Students Request Room Allocation**
- Students submit room allocation requests
- Can specify preferences (room type, floor, special requirements)
- Requests are stored with priority scoring

### 3. **Priority-Based Allocation**
- **Request timestamp** (first-come, first-served)
- **User role priority** (admin > warden > operations > student)
- **Account seniority** (older accounts get priority)
- **Special requirements** consideration

### 4. **Batch Allocation Process**
- Automated or manual batch processing
- Allocates rooms to pending requests in priority order
- Updates room occupancy and user assignments
- Handles waitlist for unavailable rooms

### 5. **Waitlist Management**
- Students without available rooms go to waitlist
- Automatic processing when rooms become available
- Position-based waitlist with priority scoring

## 🗄️ **Database Tables**

### **1. `rooms` Table**
```sql
- id (UUID, Primary Key)
- room_number (VARCHAR, Unique)
- floor (INTEGER)
- room_type (VARCHAR: standard, deluxe, premium, suite)
- capacity (INTEGER)
- occupied (INTEGER)
- price (DECIMAL)
- status (VARCHAR: available, occupied, maintenance, reserved)
- amenities (TEXT[])
- created_at, updated_at (TIMESTAMP)
```

### **2. `room_requests` Table**
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- requested_at (TIMESTAMP)
- status (VARCHAR: pending, allocated, waitlisted, cancelled, expired)
- priority_score (INTEGER, Calculated)
- preferred_room_type (VARCHAR)
- preferred_floor (INTEGER)
- special_requirements (TEXT)
- allocated_room_id (UUID, Foreign Key to rooms)
- allocated_at (TIMESTAMP)
- allocated_by (UUID, Foreign Key to users)
- waitlist_position (INTEGER)
- expires_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

### **3. `room_allocations` Table**
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- room_id (UUID, Foreign Key to rooms)
- allocated_at (TIMESTAMP)
- allocated_by (UUID, Foreign Key to users)
- allocation_type (VARCHAR: automatic, manual, transfer)
- status (VARCHAR: active, ended, transferred)
- ended_at (TIMESTAMP)
- ended_reason (VARCHAR)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### **4. `room_waitlist` Table**
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- room_request_id (UUID, Foreign Key to room_requests)
- position (INTEGER)
- preferred_room_type (VARCHAR)
- priority_score (INTEGER)
- added_at (TIMESTAMP)
- notified_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

### **5. `allocation_batches` Table**
```sql
- id (UUID, Primary Key)
- batch_name (VARCHAR)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- status (VARCHAR: running, completed, failed)
- total_requests (INTEGER)
- allocated_count (INTEGER)
- waitlisted_count (INTEGER)
- errors (TEXT[])
- run_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
```

## 🔧 **Key Functions**

### **1. `calculate_priority_score(user_id, requested_at)`**
Calculates priority score based on:
- Request timestamp (earlier = higher score)
- User role (admin: +10000, warden: +8000, operations: +6000, student: +1000)
- Account seniority (days since account creation)

### **2. `find_available_rooms(preferred_room_type, preferred_floor)`**
Finds available rooms matching preferences:
- Status = 'available'
- Occupied < capacity
- Matches room type and floor preferences
- Returns available spots count

### **3. `run_batch_allocation(batch_name, run_by_user_id)`**
Main allocation function:
- Processes requests in priority order
- Allocates available rooms
- Updates room occupancy
- Creates allocation records
- Handles waitlist for unavailable rooms
- Returns batch ID for tracking

### **4. `process_waitlist()`**
Processes waitlist when rooms become available:
- Finds available rooms
- Allocates to highest priority waitlisted users
- Updates all related records
- Returns count of processed entries

## 🚀 **API Endpoints**

### **Room Management**
- `POST /api/room-allocation/rooms` - Admin adds room
- `GET /api/room-allocation/rooms` - Get all rooms with availability

### **Request Management**
- `POST /api/room-allocation/request` - Student requests room
- `GET /api/room-allocation/request` - Get user's request status
- `GET /api/room-allocation/requests` - Get all requests (Admin)
- `PUT /api/room-allocation/request/:id/cancel` - Cancel request

### **Allocation Processing**
- `POST /api/room-allocation/batch-allocate` - Run batch allocation
- `GET /api/room-allocation/batch-status/:id` - Get batch status
- `POST /api/room-allocation/process-waitlist` - Process waitlist

### **Monitoring**
- `GET /api/room-allocation/waitlist` - Get waitlist (Admin)
- `GET /api/room-allocation/statistics` - Get allocation statistics

## 📊 **Usage Examples**

### **1. Admin Adds Rooms**
```bash
POST /api/room-allocation/rooms
{
  "room_number": "101",
  "floor": 1,
  "room_type": "standard",
  "capacity": 2,
  "price": 5000.00,
  "amenities": ["AC", "WiFi", "Study Table"]
}
```

### **2. Student Requests Room**
```bash
POST /api/room-allocation/request
{
  "preferred_room_type": "standard",
  "preferred_floor": 1,
  "special_requirements": "Need ground floor access",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### **3. Run Batch Allocation**
```bash
POST /api/room-allocation/batch-allocate
{
  "batch_name": "Monthly Allocation - December 2024"
}
```

### **4. Check Statistics**
```bash
GET /api/room-allocation/statistics
```

Response:
```json
{
  "success": true,
  "data": {
    "rooms": {
      "total": 100,
      "total_capacity": 200,
      "total_occupied": 150,
      "available": 25,
      "occupancy_rate": "75.00"
    },
    "requests": {
      "pending": 15,
      "waitlisted": 8,
      "allocated": 150,
      "total": 173
    }
  }
}
```

## 🔄 **Automated Processes**

### **1. Priority Calculation**
- Automatically calculated when requests are created
- Updated during batch allocation
- Considers role, seniority, and request time

### **2. Room Status Updates**
- Automatically updated when occupancy changes
- Status changes from 'available' to 'occupied' when full
- Reverts to 'available' when space becomes free

### **3. Waitlist Processing**
- Can be triggered manually or automatically
- Processes when rooms become available
- Maintains priority order

## 🛡️ **Security & Permissions**

### **Row Level Security (RLS)**
- Users can only view their own requests
- Admins can manage all requests and rooms
- Public access to room availability

### **Role-Based Access**
- **Students**: Can request and view their own requests
- **Admins**: Full access to all functions
- **Operations**: Can manage rooms and allocations

## 📈 **Monitoring & Analytics**

### **Batch Tracking**
- Track allocation batch performance
- Monitor success/failure rates
- Error logging and reporting

### **Statistics Dashboard**
- Real-time occupancy rates
- Request status distribution
- Waitlist length and processing

## 🚀 **Setup Instructions**

1. **Run the schema**:
   ```sql
   -- Copy and paste room-allocation-schema.sql in Supabase SQL Editor
   ```

2. **Add the route** to your main server:
   ```javascript
   const roomAllocationRoutes = require('./routes/room-allocation');
   app.use('/api/room-allocation', roomAllocationRoutes);
   ```

3. **Test the system**:
   - Create some rooms as admin
   - Submit room requests as students
   - Run batch allocation
   - Monitor results

## 🎯 **Benefits**

✅ **Automated Priority System** - Fair allocation based on multiple factors
✅ **Scalable Architecture** - Handles large numbers of requests efficiently
✅ **Waitlist Management** - No lost requests, automatic processing
✅ **Audit Trail** - Complete history of all allocations
✅ **Real-time Monitoring** - Live statistics and status tracking
✅ **Flexible Preferences** - Students can specify room preferences
✅ **Batch Processing** - Efficient bulk allocation
✅ **Error Handling** - Robust error management and recovery

This system provides a complete, production-ready room allocation solution that can handle complex scenarios and scale with your hostel management needs!
