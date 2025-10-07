@echo off
echo Quick fix for foreign key constraints...
echo.

cd /d "%~dp0"

node quick-fix-constraints.js

echo.
echo Quick fix completed!
pause
