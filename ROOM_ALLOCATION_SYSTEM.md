# 🏠 HostelHaven Room Allocation System

A comprehensive room allocation system built with React frontend and Node.js/Express backend with PostgreSQL database.

## 🚀 Features

### **Admin Features**
- **Room Management**: Add, edit, and manage hostel rooms
- **Allocation Dashboard**: Process room requests manually or in batches
- **Waitlist Management**: Monitor and process waitlisted students
- **Statistics Dashboard**: View occupancy rates and allocation metrics
- **Real-time Updates**: Live data synchronization across all tables

### **Student Features**
- **Room Request**: Submit room allocation requests with preferences
- **Status Tracking**: Monitor request status and waitlist position
- **Room Browser**: View available rooms and their details
- **Self-Service**: Cancel or modify requests as needed

## 📋 System Architecture

### **Database Tables**
1. **`rooms`** - Room information and availability
2. **`room_requests`** - Student room requests
3. **`room_allocations`** - Allocation history and tracking
4. **`room_waitlist`** - Waitlisted students queue
5. **`allocation_batches`** - Batch allocation process logs
6. **`users`** - User accounts and profiles
7. **`user_profiles`** - Detailed student information

### **Key Functions**
- **`run_batch_allocation()`** - Automated room allocation
- **`process_waitlist()`** - Process waitlisted students
- **`sync_allocation_tables()`** - Ensure data consistency
- **`find_available_rooms()`** - Find rooms matching criteria
- **`calculate_priority_score()`** - Calculate allocation priority

## 🛠️ Installation & Setup

### **Backend Setup**
1. Install dependencies:
```bash
cd hostelhaven-b-end
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run database migrations:
```bash
# Run the complete database setup
psql -d your_database -f complete-database-setup.sql

# Or run the room allocation schema
psql -d your_database -f room-allocation-schema.sql
```

4. Start the server:
```bash
npm start
```

### **Frontend Setup**
1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm start
```

## 🎯 Usage Guide

### **For Administrators**

#### **1. Room Management**
- Navigate to "Room Management" in the admin panel
- Click "Add Room" to create new rooms
- Set room details: number, floor, type, capacity, price, amenities
- Edit existing rooms or view availability status

#### **2. Processing Allocations**
- Go to "Allocation Dashboard"
- View all pending room requests
- **Manual Allocation**: Click "Allocate" on individual requests
- **Batch Allocation**: Click "Run Batch Allocation" to process all pending requests
- **Waitlist Processing**: Click "Process Waitlist" when rooms become available

#### **3. Monitoring & Statistics**
- Check "Statistics" for occupancy rates and metrics
- Monitor "Waitlist Management" for queue status
- View real-time alerts and recommendations

### **For Students**

#### **1. Submitting Room Request**
- Navigate to "My Room Request"
- Click "Submit Room Request"
- Fill in preferences:
  - Room type (standard/deluxe/premium/suite)
  - Preferred floor
  - Special requirements
  - Expiration date (optional)

#### **2. Tracking Request Status**
- View current request status (pending/allocated/waitlisted)
- Check priority score and waitlist position
- Monitor allocated room details

#### **3. Managing Requests**
- Cancel pending requests
- Delete requests (if not allocated)
- View available rooms

## 🔄 Allocation Workflow

### **1. Setup Phase**
```
Admin adds rooms → Rooms become available → Students can request
```

### **2. Request Phase**
```
Student submits request → System validates → Request marked as "pending"
```

### **3. Allocation Phase**
```
Admin runs batch allocation → Priority calculation → Room assignment
```

### **4. Waitlist Phase**
```
No rooms available → Student added to waitlist → Position assigned
```

### **5. Processing Phase**
```
Rooms become available → Process waitlist → Allocate to waitlisted students
```

## 📊 Priority System

The system uses a sophisticated priority scoring algorithm:

### **Base Score**
- Earlier requests get higher scores
- Time-based priority calculation

### **Role-Based Priority**
- **Admin**: +10,000 points
- **Warden**: +8,000 points
- **Staff**: +6,000 points
- **Student**: +1,000 points
- **Guest**: +500 points

### **Seniority Bonus**
- Older accounts get additional priority
- Calculated in days since account creation

## 🔧 API Endpoints

### **Room Management**
- `GET /api/room-allocation/rooms` - List all rooms
- `POST /api/room-allocation/rooms` - Create new room
- `PUT /api/room-allocation/rooms/:id` - Update room

### **Request Management**
- `POST /api/room-allocation/request` - Submit room request
- `GET /api/room-allocation/request` - Get user's request
- `GET /api/room-allocation/requests` - List all requests (admin)
- `PUT /api/room-allocation/requests/:id/approve` - Approve request
- `PUT /api/room-allocation/requests/:id/cancel` - Cancel request

### **Allocation Processing**
- `POST /api/room-allocation/batch-allocate` - Run batch allocation
- `POST /api/room-allocation/process-waitlist` - Process waitlist
- `GET /api/room-allocation/waitlist` - Get waitlist (admin)

### **Statistics**
- `GET /api/room-allocation/statistics` - Get allocation statistics

## 🛡️ Security Features

### **Row Level Security (RLS)**
- Students can only view their own requests
- Admins have full access to all data
- Secure data isolation

### **Authentication**
- JWT-based authentication
- Role-based access control
- Secure API endpoints

### **Data Validation**
- Input validation on all forms
- Server-side validation
- SQL injection protection

## 🔍 Monitoring & Alerts

### **Real-time Alerts**
- High occupancy warnings (>90%)
- Waitlist processing notifications
- Pending request alerts

### **Statistics Dashboard**
- Occupancy rate monitoring
- Request processing metrics
- System performance indicators

## 🚨 Troubleshooting

### **Common Issues**

#### **"Policy already exists" Error**
- Run the updated schema with `DROP POLICY IF EXISTS` statements
- The schema is now idempotent and safe to run multiple times

#### **Data Inconsistency**
- Use the `sync_allocation_tables()` function
- Ensures all related tables are updated atomically

#### **Room Occupancy Issues**
- Check both `occupied` and `current_occupancy` columns
- The system handles both naming conventions

### **Database Maintenance**
```sql
-- Check data consistency
SELECT 
  r.room_number,
  r.occupied,
  r.current_occupancy,
  COUNT(ra.id) as actual_allocations
FROM rooms r
LEFT JOIN room_allocations ra ON r.id = ra.room_id AND ra.status = 'active'
GROUP BY r.id, r.room_number, r.occupied, r.current_occupancy;

-- Reset room occupancy if needed
UPDATE rooms SET 
  occupied = (SELECT COUNT(*) FROM room_allocations WHERE room_id = rooms.id AND status = 'active'),
  current_occupancy = (SELECT COUNT(*) FROM room_allocations WHERE room_id = rooms.id AND status = 'active');
```

## 📈 Performance Optimization

### **Database Indexes**
- Optimized indexes on frequently queried columns
- Composite indexes for complex queries
- Partial indexes for filtered data

### **Caching Strategy**
- Room availability caching
- User session caching
- Statistics caching

### **Query Optimization**
- Efficient JOIN operations
- Optimized WHERE clauses
- Pagination for large datasets

## 🔮 Future Enhancements

### **Planned Features**
- Email notifications for status changes
- Mobile app integration
- Advanced reporting and analytics
- Room transfer functionality
- Payment integration
- Maintenance request system

### **Scalability Improvements**
- Database sharding
- Microservices architecture
- Real-time WebSocket updates
- Advanced caching strategies

## 📞 Support

For technical support or questions:
- Check the troubleshooting section
- Review the API documentation
- Contact the development team

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for HostelHaven**