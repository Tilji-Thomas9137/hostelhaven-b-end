@echo off
echo ========================================
echo HostelHaven Clean Test Setup
echo ========================================
echo.

echo Step 1: Seeding clean test data...
psql -h your-supabase-host -U postgres -d postgres -f sql/clean-test-data.sql

echo.
echo Step 2: Setting up authentication credentials...
node scripts/setup-clean-test-users.js

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Test Credentials:
echo Admin: admin@test.com / Test123!
echo Warden: warden@test.com / Test123!
echo Operations: ops@test.com / Test123!
echo Student: student@test.com / Test123!
echo Parent: parent@test.com / Test123!
echo.
echo Next Steps:
echo 1. Start backend: node server.js
echo 2. Start frontend: npm run dev (in frontend directory)
echo 3. Go to http://localhost:5173/login
echo 4. Test each role with the credentials above
echo.
pause
