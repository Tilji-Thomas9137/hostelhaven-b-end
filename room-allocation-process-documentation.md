# Room Allocation Process After Operations Assistant Approval

## Overview
When an operations assistant approves a room request, the system goes through several steps to allocate the room to the student and update all related records.

## Frontend Process (Operations Dashboard)

### 1. **Room Request Management Interface**
- Operations assistant sees pending room requests in the "Room Request Management" section
- Each request shows student details, requested room preferences, and current status
- Assistant clicks "Approve" button on a pending request

### 2. **Room Selection Modal**
- System fetches available rooms that match the student's preferences
- If student requested a specific room, only that room is shown
- Assistant selects the room to allocate and clicks "Confirm Allocation"

### 3. **API Call Made**
- Frontend makes PUT request to: `/api/room-requests/{request_id}/approve`
- Payload includes: `{ room_id: "selected-room-id", notes: "Approved by Hostel Operations Assistant" }`

## Backend Process (Multiple API Endpoints)

The system has **3 different approval endpoints** that handle room allocation:

### **Endpoint 1: `/api/room-requests/{id}/approve`** (Primary - Used by Operations Dashboard)
**File**: `hostelhaven-b-end/routes/room-requests.js` (lines 1277-1440)

**Process**:
1. **Validate Request**: Check if request exists and is in 'pending' status
2. **Check Room Availability**: Verify room has capacity and is available
3. **Update Request Status**: Set status to 'approved', add processed_by and processed_at
4. **Create Room Allocation**: Insert new record in `room_allocations` table with:
   - `user_id`: Student's user ID
   - `room_id`: Allocated room ID
   - `allocation_status`: 'confirmed'
   - `allocated_at`: Current timestamp
   - `start_date`: Current date
5. **Update Room Occupancy**: Increment `current_occupancy` and update room status
6. **Update Student Profile**: Set `room_id` in `user_profiles` table

### **Endpoint 2: `/api/room-allocation/requests/{id}/approve`** (Admin Dashboard)
**File**: `hostelhaven-b-end/routes/room-allocation.js` (lines 428-769)

**Process**:
1. **Validate Request**: Check request status and room availability
2. **Enforce Specific Room**: If student requested specific room, ensure approval matches
3. **Check Existing Allocation**: Look for existing allocation in `room_assignments` table
4. **Use RPC Function**: Calls `sync_allocation_tables` RPC to update all tables atomically
5. **Update Multiple Tables**: Updates `room_requests`, `room_allocations`, `room_assignments`, and `rooms`

### **Endpoint 3: `/api/rooms/{id}/approve`** (Legacy)
**File**: `hostelhaven-b-end/routes/rooms.js` (lines 466-597)

**Process**:
1. **Validate Request**: Check request exists and is pending
2. **Check Room Capacity**: Verify room has available space
3. **Create Allocation**: Insert into `room_allocations` with `student_profile_id`
4. **Update Request**: Set status to 'approved'
5. **Update User**: Set `room_id` in `users` table

## Database Changes After Approval

### **Tables Updated**:

1. **`room_requests`**:
   - `status`: 'pending' → 'approved'
   - `processed_at`: Current timestamp
   - `processed_by`: Staff member ID
   - `notes`: Approval notes

2. **`room_allocations`** (NEW RECORD):
   - `user_id`: Student's user ID
   - `room_id`: Allocated room ID
   - `allocation_status`: 'confirmed'
   - `allocated_at`: Current timestamp
   - `start_date`: Current date
   - `allocation_date`: Current timestamp

3. **`rooms`**:
   - `current_occupancy`: Incremented by 1
   - `status`: Updated based on new occupancy ('available' → 'partially_filled' → 'full')

4. **`user_profiles`** (or `users`):
   - `room_id`: Set to allocated room ID

## Key Differences Between Endpoints

| Feature | `/api/room-requests/{id}/approve` | `/api/room-allocation/requests/{id}/approve` | `/api/rooms/{id}/approve` |
|---------|-----------------------------------|---------------------------------------------|---------------------------|
| **Used By** | Operations Dashboard | Admin Dashboard | Legacy |
| **Allocation Table** | `room_allocations` | `room_allocations` + `room_assignments` | `room_allocations` |
| **User Reference** | `user_id` | `user_id` | `student_profile_id` |
| **RPC Function** | No | Yes (`sync_allocation_tables`) | No |
| **Room Occupancy** | Direct update | Via RPC | Direct update |

## Current Issues & Recommendations

### **Issues Identified**:
1. **Multiple Endpoints**: 3 different approval endpoints with different logic
2. **Inconsistent User References**: Some use `user_id`, others use `student_profile_id`
3. **Table Inconsistencies**: Some update `room_assignments`, others don't
4. **Missing Unique Constraint**: The `room_allocations` table needs unique constraint on `user_id`

### **Recommendations**:
1. **Standardize on One Endpoint**: Use `/api/room-requests/{id}/approve` as primary
2. **Add Unique Constraint**: Implement the unique constraint we discussed earlier
3. **Consistent User References**: Always use `user_id` for consistency
4. **Atomic Updates**: Use transactions or RPC functions for consistency

## Testing the Process

To test if room allocation is working:

1. **Check Room Allocation Created**:
   ```sql
   SELECT * FROM room_allocations WHERE user_id = 'student-user-id';
   ```

2. **Verify Room Occupancy Updated**:
   ```sql
   SELECT room_number, current_occupancy, capacity FROM rooms WHERE id = 'room-id';
   ```

3. **Check Student Can Submit Cleaning Requests**:
   - Login as student
   - Try to submit cleaning request
   - Should work without "You must have an allocated room" error

## Summary

The room allocation process is **functional but has inconsistencies**. The Operations Dashboard uses the primary endpoint (`/api/room-requests/{id}/approve`) which correctly creates room allocations. However, the system would benefit from standardization and the unique constraint implementation we discussed earlier.
