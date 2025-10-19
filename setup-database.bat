@echo off
echo Setting up HostelHaven database...
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.

echo Installing dependencies...
npm install

echo.
echo Running database setup...
node setup-db.js

echo.
echo Database setup completed!
echo Please restart your backend server.
pause
