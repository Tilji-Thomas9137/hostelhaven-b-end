-- Add room_id column to users table if it doesn't exist
-- This script will safely add the room_id column with proper constraints

DO $$
BEGIN
    -- Check if room_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'room_id' 
        AND table_schema = 'public'
    ) THEN
        -- Add room_id column
        ALTER TABLE users ADD COLUMN room_id UUID;
        RAISE NOTICE '✅ Added room_id column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ room_id column already exists in users table';
    END IF;
    
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_room' 
        AND table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE users ADD CONSTRAINT fk_users_room 
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key constraint fk_users_room';
    ELSE
        RAISE NOTICE 'ℹ️ Foreign key constraint fk_users_room already exists';
    END IF;
    
    -- Check if index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_users_room_id' 
        AND tablename = 'users'
    ) THEN
        -- Add index for better performance
        CREATE INDEX idx_users_room_id ON users(room_id);
        RAISE NOTICE '✅ Added index idx_users_room_id';
    ELSE
        RAISE NOTICE 'ℹ️ Index idx_users_room_id already exists';
    END IF;
    
    RAISE NOTICE '🎉 Users table schema update completed successfully!';
END $$;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'room_id'
AND table_schema = 'public';

-- Show foreign key constraints
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'users'
AND kcu.column_name = 'room_id';
