-- Add amenities column to room_requests table
ALTER TABLE room_requests 
ADD COLUMN amenities TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN room_requests.amenities IS 'Array of preferred amenities for room allocation request';
