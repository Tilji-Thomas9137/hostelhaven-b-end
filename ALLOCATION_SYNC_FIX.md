# Room Allocation Table Synchronization Fix

## Issues Identified

### 1. Column Name Inconsistency
- **Problem**: The `rooms` table has two different column names for occupancy across different schema files:
  - `room-allocation-schema.sql` uses `occupied`
  - `complete-database-setup.sql` uses `current_occupancy`
- **Impact**: Allocation functions fail to update room occupancy correctly

### 2. Missing Table Updates
- **Problem**: When an allocation is made, not all related tables are updated:
  - `users.room_id` - ✅ Updated
  - `user_profiles.room_id` - ❌ Missing
  - `rooms.occupied/current_occupancy` - ❌ Inconsistent
  - `room_allocations` - ✅ Updated
  - `room_requests` - ✅ Updated

### 3. Inconsistent Room Status Logic
- **Problem**: Room status updates don't handle both column names
- **Impact**: Rooms may show incorrect availability status

## Fixes Applied

### 1. Updated Database Functions

#### `find_available_rooms()` Function
```sql
-- Now handles both column names using COALESCE
COALESCE(r.occupied, r.current_occupancy, 0) as occupied
```

#### `run_batch_allocation()` Function
```sql
-- Updates both occupancy columns
UPDATE rooms 
SET 
    occupied = COALESCE(occupied, 0) + 1,
    current_occupancy = COALESCE(current_occupancy, 0) + 1,
    status = CASE 
        WHEN (COALESCE(occupied, current_occupancy, 0) + 1) >= capacity THEN 'occupied'
        ELSE 'available'
    END
WHERE id = room_record.room_id;

-- Updates user profile
UPDATE user_profiles 
SET room_id = room_record.room_id
WHERE user_id = request_record.user_id;
```

#### `process_waitlist()` Function
- Same updates as batch allocation function
- Ensures waitlist processing also updates all tables

### 2. New Synchronization Function

Created `sync_allocation_tables()` function that:
- Atomically updates all related tables
- Handles both column name variations
- Provides error handling
- Ensures data consistency

```sql
CREATE OR REPLACE FUNCTION sync_allocation_tables(
    p_user_id UUID,
    p_room_id UUID,
    p_allocated_by UUID DEFAULT NULL,
    p_allocation_type VARCHAR(20) DEFAULT 'manual'
) RETURNS BOOLEAN
```

### 3. Updated API Routes

#### Manual Approval Route
- Now uses the `sync_allocation_tables()` function
- Ensures all tables are updated atomically
- Better error handling

#### Room Availability Calculation
- Handles both column names in statistics
- Consistent availability checking

## Tables Updated During Allocation

When a room allocation is made, the following tables are now updated:

1. **`rooms`**
   - `occupied` or `current_occupancy` +1
   - `status` updated based on capacity

2. **`users`**
   - `room_id` set to allocated room

3. **`user_profiles`**
   - `room_id` set to allocated room

4. **`room_requests`**
   - `status` set to 'allocated'
   - `allocated_room_id` set
   - `allocated_at` timestamp set

5. **`room_allocations`**
   - New record created with allocation details

## Testing Recommendations

1. **Test Room Allocation**
   - Create a room request
   - Approve it manually
   - Verify all tables are updated

2. **Test Batch Allocation**
   - Create multiple room requests
   - Run batch allocation
   - Verify all allocations update all tables

3. **Test Waitlist Processing**
   - Create requests when no rooms available
   - Add rooms to make space
   - Process waitlist
   - Verify waitlisted users get allocated

4. **Test Statistics**
   - Check room availability statistics
   - Verify occupancy calculations are correct

## Database Schema Consistency

To ensure consistency, consider:

1. **Standardize Column Names**
   - Choose either `occupied` or `current_occupancy`
   - Update all references to use the chosen name

2. **Add Constraints**
   - Ensure `occupied`/`current_occupancy` <= `capacity`
   - Add check constraints for data integrity

3. **Regular Maintenance**
   - Run periodic checks to ensure data consistency
   - Monitor for orphaned records

## Usage

The fixes are backward compatible and will work with both column naming conventions. The system will automatically detect which column exists and use the appropriate one.

For new installations, it's recommended to use the `complete-database-setup.sql` schema which uses `current_occupancy` consistently.
