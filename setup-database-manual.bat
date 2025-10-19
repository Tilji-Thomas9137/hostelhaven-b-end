@echo off
echo ========================================
echo HostelHaven Database Setup
echo ========================================
echo.
echo Since the automatic setup failed, please follow these manual steps:
echo.
echo 1. Open your Supabase dashboard
echo 2. Go to SQL Editor
echo 3. Copy the contents of one of these files:
echo    - complete-database-setup.sql (for full setup)
echo    - setup-room-allocations.sql (for just the missing table)
echo 4. Paste and execute the SQL
echo 5. Restart your backend server
echo.
echo ========================================
echo Files created:
echo - complete-database-setup.sql (full database setup)
echo - setup-room-allocations.sql (just room_allocations table)
echo ========================================
echo.
pause
