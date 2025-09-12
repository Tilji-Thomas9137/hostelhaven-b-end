# 🏠 Complete Room Allocation System - Implementation Guide

## 🎯 **System Overview**

This is a comprehensive room allocation system that handles the complete workflow from room creation to student allocation, including waitlist management and batch processing. The system is fully integrated into your existing HostelHaven application.

## 🚀 **Quick Start**

### 1. **Setup the Database**
```bash
cd hostelhaven-b-end
node setup-room-allocation.js
```

This script will:
- Create all 5 database tables
- Set up indexes for performance
- Configure Row Level Security
- Create allocation functions
- Add sample rooms

### 2. **Start the Application**
```bash
# Backend
cd hostelhaven-b-end
npm start

# Frontend
cd hostelhaven-f-end
npm run dev
```

### 3. **Access the System**
- **Admin Dashboard**: Navigate to Admin Dashboard → Room Allocations tab
- **Student Dashboard**: Navigate to Student Dashboard → Room Allocation tab

## 🏗️ **System Architecture**

### **Database Tables**

#### 1. **`rooms`** - Room Management
```sql
- id (UUID, Primary Key)
- room_number (VARCHAR, Unique)
- floor (INTEGER)
- room_type (standard, deluxe, premium, suite)
- capacity (INTEGER)
- occupied (INTEGER)
- price (DECIMAL)
- status (available, occupied, maintenance, reserved)
- amenities (TEXT[])
```

#### 2. **`room_requests`** - Student Requests
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- requested_at (TIMESTAMP)
- status (pending, allocated, waitlisted, cancelled, expired)
- priority_score (INTEGER, Calculated)
- preferred_room_type (VARCHAR)
- preferred_floor (INTEGER)
- special_requirements (TEXT)
- allocated_room_id (UUID, Foreign Key)
```

#### 3. **`room_allocations`** - Allocation History
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- room_id (UUID, Foreign Key)
- allocated_at (TIMESTAMP)
- allocation_type (automatic, manual, transfer)
- status (active, ended, transferred)
```

#### 4. **`room_waitlist`** - Waitlist Management
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- room_request_id (UUID, Foreign Key)
- position (INTEGER)
- priority_score (INTEGER)
```

#### 5. **`allocation_batches`** - Batch Processing
```sql
- id (UUID, Primary Key)
- batch_name (VARCHAR)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- status (running, completed, failed)
- total_requests (INTEGER)
- allocated_count (INTEGER)
- waitlisted_count (INTEGER)
```

### **Key Functions**

#### 1. **`calculate_priority_score(user_id, requested_at)`**
Calculates priority based on:
- Request timestamp (earlier = higher priority)
- User role (admin > warden > operations > student)
- Account seniority (older accounts get priority)

#### 2. **`run_batch_allocation(batch_name, run_by_user_id)`**
Main allocation function that:
- Processes requests in priority order
- Allocates available rooms
- Updates room occupancy
- Creates allocation records
- Handles waitlist for unavailable rooms

#### 3. **`process_waitlist()`**
Processes waitlist when rooms become available:
- Finds available rooms
- Allocates to highest priority waitlisted users
- Updates all related records

## 🔄 **Complete Workflow**

### **Step 1: Admin Adds Rooms**
```javascript
// Via Admin Dashboard → Room Allocations → Rooms tab
// Click "Add Room" button
{
  "room_number": "101",
  "floor": 1,
  "room_type": "standard",
  "capacity": 2,
  "price": 5000.00,
  "amenities": ["AC", "WiFi", "Study Table"]
}
```

### **Step 2: Students Request Room Allocation**
```javascript
// Via Student Dashboard → Room Allocation tab
// Click "Request Room Allocation" button
{
  "preferred_room_type": "standard",
  "preferred_floor": 1,
  "special_requirements": "Need ground floor access"
}
```

### **Step 3: Admin Runs Batch Allocation**
```javascript
// Via Admin Dashboard → Room Allocations → Overview tab
// Click "Run Batch Allocation" button
{
  "batch_name": "Monthly Allocation - December 2024"
}
```

### **Step 4: System Processes Requests**
- Calculates priority scores for all pending requests
- Allocates rooms based on priority and preferences
- Updates room occupancy
- Creates allocation records
- Adds unallocated students to waitlist

### **Step 5: Waitlist Processing**
```javascript
// Via Admin Dashboard → Room Allocations → Waitlist tab
// Click "Process Waitlist" button
// Automatically allocates rooms to waitlisted students when available
```

## 🎨 **User Interface Components**

### **Admin Dashboard - Room Allocations Tab**

#### **Overview Tab**
- Statistics cards (Total Rooms, Allocated, Pending, Waitlist)
- Occupancy overview
- Quick actions (Add Room, Run Batch Allocation, Process Waitlist)

#### **Rooms Tab**
- Room management table
- Search and filter functionality
- Add/Edit/Delete room capabilities
- Room status indicators

#### **Requests Tab**
- All room requests with status
- Priority scores display
- Student information
- Allocation details

#### **Waitlist Tab**
- Waitlist position tracking
- Priority scores
- Process waitlist functionality

### **Student Dashboard - Room Allocation Tab**

#### **Overview Tab**
- Current room status
- Request status
- Available rooms count
- Quick actions

#### **Available Rooms Tab**
- Browse available rooms
- Room details and amenities
- Search and filter options

## 🔌 **API Endpoints**

### **Room Management**
- `POST /api/room-allocation/rooms` - Add new room
- `GET /api/room-allocation/rooms` - Get all rooms with availability

### **Request Management**
- `POST /api/room-allocation/request` - Submit room request
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

## 🛡️ **Security & Permissions**

### **Row Level Security (RLS)**
- Users can only view their own requests
- Admins can manage all requests and rooms
- Public access to room availability

### **Role-Based Access**
- **Students**: Can request and view their own requests
- **Admins**: Full access to all functions
- **Operations**: Can manage rooms and allocations

## 📊 **Monitoring & Analytics**

### **Real-time Statistics**
- Total rooms and capacity
- Current occupancy rates
- Pending requests count
- Waitlist length

### **Batch Tracking**
- Track allocation batch performance
- Monitor success/failure rates
- Error logging and reporting

## 🎯 **Usage Examples**

### **Example 1: Complete Allocation Process**

1. **Admin creates rooms:**
   ```bash
   POST /api/room-allocation/rooms
   {
     "room_number": "101",
     "floor": 1,
     "room_type": "standard",
     "capacity": 2,
     "price": 5000
   }
   ```

2. **Students request rooms:**
   ```bash
   POST /api/room-allocation/request
   {
     "preferred_room_type": "standard",
     "preferred_floor": 1
   }
   ```

3. **Admin runs batch allocation:**
   ```bash
   POST /api/room-allocation/batch-allocate
   {
     "batch_name": "Monthly Allocation"
   }
   ```

4. **Check results:**
   ```bash
   GET /api/room-allocation/statistics
   ```

### **Example 2: Waitlist Processing**

1. **When rooms become available:**
   ```bash
   POST /api/room-allocation/process-waitlist
   ```

2. **Check waitlist status:**
   ```bash
   GET /api/room-allocation/waitlist
   ```

## 🔧 **Configuration**

### **Environment Variables**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Database Setup**
The system automatically creates all necessary database structures when you run the setup script.

## 🚀 **Deployment**

### **Production Deployment**
1. Run the setup script on your production database
2. Deploy the backend with the new room allocation routes
3. Deploy the frontend with the new components
4. Test the complete workflow

### **Scaling Considerations**
- The system is designed to handle large numbers of requests efficiently
- Database indexes ensure fast queries even with thousands of records
- Batch processing prevents system overload during peak allocation periods

## 🎉 **Benefits**

✅ **Automated Priority System** - Fair allocation based on multiple factors  
✅ **Scalable Architecture** - Handles large numbers of requests efficiently  
✅ **Waitlist Management** - No lost requests, automatic processing  
✅ **Audit Trail** - Complete history of all allocations  
✅ **Real-time Monitoring** - Live statistics and status tracking  
✅ **Flexible Preferences** - Students can specify room preferences  
✅ **Batch Processing** - Efficient bulk allocation  
✅ **Error Handling** - Robust error management and recovery  
✅ **User-Friendly Interface** - Intuitive admin and student dashboards  
✅ **Complete Integration** - Seamlessly integrated with existing system  

## 📚 **Next Steps**

1. **Run the setup script** to initialize the database
2. **Test the system** with sample data
3. **Customize room types and pricing** as needed
4. **Train staff** on the new allocation process
5. **Monitor performance** and optimize as needed

This system provides a complete, production-ready room allocation solution that can handle complex scenarios and scale with your hostel management needs!


