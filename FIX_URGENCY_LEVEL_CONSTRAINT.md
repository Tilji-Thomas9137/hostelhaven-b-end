# Fix Urgency Level Constraint Error

## Problem
Room requests are failing with the error:
```
new row for relation "room_requests" violates check constraint "check_urgency_level"
```

## Root Cause
There's a mismatch between:
- **Backend validation**: accepts `['low', 'medium', 'high']`
- **Database constraint**: expects `['low', 'normal', 'high', 'urgent']`
- **Frontend**: sends `'medium'`

## Solution
Update the database constraint to match the backend validation.

### SQL Fix
Go to your Supabase dashboard → SQL Editor and run:

```sql
-- Drop the existing constraint
ALTER TABLE room_requests 
DROP CONSTRAINT IF EXISTS check_urgency_level;

-- Add the corrected constraint that matches backend validation
ALTER TABLE room_requests 
ADD CONSTRAINT check_urgency_level 
CHECK (urgency_level IN ('low', 'medium', 'high'));

-- Update any existing records with 'normal' to 'medium'
UPDATE room_requests 
SET urgency_level = 'medium' 
WHERE urgency_level = 'normal';

-- Verify the constraint
SELECT DISTINCT urgency_level FROM room_requests;
```

## Alternative Solution (if you prefer to keep 'normal' instead of 'medium')
If you want to keep 'normal' instead of 'medium', update the backend validation instead:

```javascript
// In hostelhaven-b-end/routes/room-requests.js line 56
body('urgency_level').optional().isIn(['low', 'normal', 'high']).withMessage('Invalid urgency level')
```

And update the frontend to send 'normal':

```javascript
// In hostelhaven-f-end/src/components/dashboard/StudentRoomRequest.jsx line 181
urgency_level: 'normal',
```

## Recommended Solution
Use the SQL fix above to update the database constraint to match the backend validation, as this requires fewer code changes.
