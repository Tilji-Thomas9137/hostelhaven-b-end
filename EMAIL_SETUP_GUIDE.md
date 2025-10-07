# Email Setup Guide for HostelHaven

This guide will help you configure email functionality for automatic student credential delivery.

## Email Configuration

The system automatically sends activation emails with login credentials when students are added. Here's how to set it up:

### 1. Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Update your `config.env` file**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

### 2. Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

#### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your_email@yahoo.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

### 3. Custom SMTP Server
```env
SMTP_HOST=your_smtp_server.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASS=your_password
SMTP_FROM=noreply@hostelhaven.com
SMTP_SECURE=false
```

## What Happens When You Add a Student

1. **Student Email**: Receives activation email with:
   - Username (admission number)
   - OTP code (valid for 10 minutes)
   - Activation link (valid for 24 hours)
   - Instructions to set up password

2. **Parent Email**: Receives activation email with:
   - Username (parent username)
   - OTP code (valid for 10 minutes)
   - Activation link (valid for 24 hours)
   - Instructions to set up password

3. **WhatsApp Notification**: Student receives WhatsApp message with activation details

4. **Supabase Auth**: Automatic user creation in Supabase authentication system

## Testing Email Functionality

1. **Start the backend server**:
   ```bash
   cd hostelhaven-b-end
   npm start
   ```

2. **Add a test student** through the admin dashboard

3. **Check email delivery**:
   - Check student email inbox
   - Check parent email inbox
   - Check spam folder if emails don't arrive

## Troubleshooting

### Emails Not Sending
- Verify SMTP credentials in `config.env`
- Check if your email provider requires app passwords
- Ensure 2FA is enabled for Gmail accounts
- Check server logs for error messages

### Emails Going to Spam
- Add your SMTP_FROM email to trusted senders
- Configure SPF/DKIM records for your domain
- Use a professional email address for SMTP_FROM

### Development Mode
If you don't want to send real emails during development, the system will log email content to the console instead of sending actual emails.

## Security Notes

- Never commit real email credentials to version control
- Use environment variables for all sensitive data
- Consider using a dedicated email service like SendGrid or Mailgun for production
- Regularly rotate app passwords

## Production Recommendations

For production environments, consider using:
- **SendGrid**: Professional email delivery service
- **Mailgun**: Developer-friendly email API
- **Amazon SES**: Cost-effective email service
- **Postmark**: Transactional email service

Update your `config.env` with the appropriate SMTP settings for your chosen service.
