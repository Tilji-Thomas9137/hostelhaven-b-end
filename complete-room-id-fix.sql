-- Complete Fix: Add room_id column and sync existing data
-- Run this script in Supabase SQL editor

-- Step 1: Add room_id column to users table if it doesn't exist
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
END $$;

-- Step 2: Sync existing room allocations to users.room_id
DO $$
DECLARE
    allocation_record RECORD;
    updated_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Starting room_id synchronization...';
    
    FOR allocation_record IN 
        SELECT DISTINCT
            ra.room_id,
            up.user_id,
            u.full_name,
            u.email
        FROM room_allocations ra
        JOIN user_profiles up ON ra.student_profile_id = up.id
        JOIN users u ON up.user_id = u.id
        WHERE ra.allocation_status IN ('confirmed', 'active')
        AND ra.room_id IS NOT NULL
        AND up.user_id IS NOT NULL
        AND (u.room_id IS NULL OR u.room_id != ra.room_id)
    LOOP
        BEGIN
            -- Update the user's room_id
            UPDATE users 
            SET room_id = allocation_record.room_id,
                updated_at = NOW()
            WHERE id = allocation_record.user_id;
            
            -- Check if update was successful
            IF FOUND THEN
                updated_count := updated_count + 1;
                RAISE NOTICE '✅ Updated user % (%) with room_id %', 
                    allocation_record.user_id, 
                    allocation_record.full_name, 
                    allocation_record.room_id;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ Failed to update user % (%): %', 
                allocation_record.user_id, 
                allocation_record.full_name, 
                SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '📊 Sync completed. Updated % users, % errors.', updated_count, error_count;
END $$;

-- Step 3: Verify the fix
SELECT 
    'Verification Results' as check_type,
    'Users with room_id' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NOT NULL
UNION ALL
SELECT 
    'Verification Results',
    'Students without room_id',
    COUNT(*)
FROM users 
WHERE room_id IS NULL
AND role = 'student';

-- Step 4: Show sample of users with room assignments
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.room_id,
    r.room_number,
    r.floor,
    r.room_type,
    ra.allocation_status
FROM users u
LEFT JOIN rooms r ON u.room_id = r.id
LEFT JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.room_id IS NOT NULL
ORDER BY u.full_name
LIMIT 10;
