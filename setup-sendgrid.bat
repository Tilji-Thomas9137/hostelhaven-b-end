@echo off
echo Setting up SendGrid email service...
echo.

cd /d "%~dp0"

echo SendGrid is already installed!
echo.
echo Now you need to:
echo.
echo 1. Go to https://app.sendgrid.com/
echo 2. Sign up for free account
echo 3. Go to Settings → API Keys
echo 4. Create API Key with "Full Access"
echo 5. Copy the API key
echo 6. Update config.env:
echo    SENDGRID_API_KEY=SG.your_actual_api_key_here
echo    SENDGRID_FROM=noreply@yourdomain.com
echo.
echo 7. Test with: node test-sendgrid.js
echo 8. Restart server: npm start
echo.
echo SendGrid Benefits:
echo - Free: 100 emails per day
echo - High deliverability
echo - No SMTP configuration needed
echo - Professional email templates
echo.
pause
