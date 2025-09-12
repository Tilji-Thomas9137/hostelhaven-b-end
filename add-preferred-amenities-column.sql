-- Add preferred_amenities column to room_requests table
-- This allows students to specify their preferred amenities when requesting rooms

ALTER TABLE room_requests 
ADD COLUMN IF NOT EXISTS preferred_amenities TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN room_requests.preferred_amenities IS 'Array of preferred amenities for room allocation request';
