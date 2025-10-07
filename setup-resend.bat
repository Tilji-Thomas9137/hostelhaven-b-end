@echo off
echo Setting up Resend email service...
echo.

cd /d "%~dp0"

echo Installing Resend...
npm install resend

echo.
echo Resend installed! Now you need to:
echo.
echo 1. Go to https://resend.com/
echo 2. Sign up for free account
echo 3. Get your API key
echo 4. Add to config.env:
echo    RESEND_API_KEY=re_your_api_key_here
echo    RESEND_FROM=HostelHaven ^<noreply@yourdomain.com^>
echo.
echo 5. Update routes/admission-registry.js to use resend-mailer
echo.
echo 6. Test with: node test-email.js
echo.
pause
