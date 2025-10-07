@echo off
echo ========================================
echo HostelHaven Test Users Setup
echo ========================================
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Checking if .env file exists...
if not exist .env (
    echo ERROR: .env file not found
    echo Please create .env file with your Supabase credentials
    echo Example:
    echo SUPABASE_URL=your_supabase_url
    echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    pause
    exit /b 1
)

echo Installing dependencies...
npm install @supabase/supabase-js dotenv

echo.
echo Setting up test user credentials...
echo This will create authentication users in Supabase Auth
echo.

node scripts/setup-test-credentials.js

echo.
echo Setup complete! Check the output above for any errors.
echo.
pause
