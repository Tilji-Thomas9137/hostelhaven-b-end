@echo off
echo Fixing email configuration...
echo.

cd /d "%~dp0"

node fix-email-config.js

echo.
echo After fixing the configuration, run:
echo   node test-email.js
echo.
pause
