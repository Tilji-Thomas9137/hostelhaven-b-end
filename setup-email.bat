@echo off
echo Setting up email functionality...
echo.

cd /d "%~dp0"

echo Testing current email configuration...
node test-email.js

echo.
echo If emails are not working, please update your config.env file with:
echo.
echo For Gmail:
echo 1. Enable 2-Factor Authentication
echo 2. Generate App Password
echo 3. Update SMTP_USER and SMTP_PASS in config.env
echo.
echo For WhatsApp:
echo 1. Set up Meta WhatsApp Business API
echo 2. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to config.env
echo.
pause
