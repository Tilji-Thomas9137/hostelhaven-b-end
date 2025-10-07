@echo off
echo Starting database cleanup...
echo.

cd /d "%~dp0"

node scripts/clean-duplicate-users.js

echo.
echo Database cleanup completed!
pause
