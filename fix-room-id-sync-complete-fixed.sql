-- Complete Room ID Synchronization Fix
-- This script ensures that users.room_id is properly synced with room_allocations
-- Run this script in your Supabase SQL editor or psql

DO $$
DECLARE
    allocation_record RECORD;
    updated_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Starting comprehensive room_id synchronization fix...';
    
    -- Step 1: Update users table with room_id from active room allocations
    RAISE NOTICE '📊 Step 1: Syncing room_id from room_allocations to users table...';
    
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

-- Step 2: Verify the synchronization
-- Show users with room assignments
SELECT 
    'Users with room assignments' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NOT NULL
UNION ALL
SELECT 
    'Students without room assignments' as status,
    COUNT(*) as count
FROM users 
WHERE room_id IS NULL
AND role = 'student';

-- Step 3: Show detailed verification
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.room_id,
    r.room_number,
    r.floor,
    r.room_type,
    ra.allocation_status,
    ra.created_at as allocation_date
FROM users u
LEFT JOIN rooms r ON u.room_id = r.id
LEFT JOIN room_allocations ra ON u.id = ra.user_id
WHERE u.room_id IS NOT NULL
ORDER BY u.full_name
LIMIT 10;

-- Step 4: Check for any remaining mismatches
SELECT 
    'Potential mismatches found' as issue_type,
    COUNT(*) as count
FROM users u
JOIN user_profiles up ON u.id = up.user_id
JOIN room_allocations ra ON up.id = ra.student_profile_id
WHERE ra.allocation_status IN ('confirmed', 'active')
AND ra.room_id IS NOT NULL
AND (u.room_id IS NULL OR u.room_id != ra.room_id);

-- Step 5: Show room allocation summary
SELECT 
    ra.allocation_status,
    COUNT(*) as allocation_count,
    COUNT(DISTINCT ra.room_id) as unique_rooms,
    COUNT(DISTINCT up.user_id) as unique_users
FROM room_allocations ra
JOIN user_profiles up ON ra.student_profile_id = up.id
GROUP BY ra.allocation_status
ORDER BY ra.allocation_status;
