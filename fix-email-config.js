const fs = require('fs');
const path = require('path');

console.log('🔧 Email Configuration Fixer\n');

// Read current config
const configPath = path.join(__dirname, 'config.env');
let configContent = '';

try {
  configContent = fs.readFileSync(configPath, 'utf8');
  console.log('📄 Current config.env found');
} catch (error) {
  console.error('❌ config.env not found!');
  process.exit(1);
}

console.log('\n🔍 Current Email Configuration:');
const smtpUserMatch = configContent.match(/SMTP_USER=(.+)/);
const smtpPassMatch = configContent.match(/SMTP_PASS=(.+)/);

if (smtpUserMatch) {
  console.log(`   SMTP_USER: ${smtpUserMatch[1]}`);
} else {
  console.log('   SMTP_USER: NOT FOUND');
}

if (smtpPassMatch) {
  console.log(`   SMTP_PASS: ${smtpPassMatch[1] === 'your_app_password' ? 'PLACEHOLDER (NEEDS UPDATE)' : 'SET'}`);
} else {
  console.log('   SMTP_PASS: NOT FOUND');
}

console.log('\n🚨 Issues Found:');
let hasIssues = false;

if (smtpUserMatch && smtpUserMatch[1].includes('your_email')) {
  console.log('   ❌ SMTP_USER is still using placeholder value');
  hasIssues = true;
}

if (smtpPassMatch && smtpPassMatch[1].includes('your_app_password')) {
  console.log('   ❌ SMTP_PASS is still using placeholder value');
  hasIssues = true;
}

if (!smtpUserMatch || !smtpPassMatch) {
  console.log('   ❌ Missing SMTP configuration');
  hasIssues = true;
}

if (hasIssues) {
  console.log('\n🔧 FIX REQUIRED:');
  console.log('1. Go to your Gmail account: https://myaccount.google.com/');
  console.log('2. Enable 2-Step Verification');
  console.log('3. Generate App Password: Security → 2-Step Verification → App passwords');
  console.log('4. Update config.env with:');
  console.log('   SMTP_USER=your_actual_email@gmail.com');
  console.log('   SMTP_PASS=your_16_character_app_password');
  console.log('\n5. Then run: node test-email.js');
} else {
  console.log('\n✅ Configuration looks good!');
  console.log('Run: node test-email.js to test');
}

console.log('\n📱 WhatsApp Status:');
const whatsappTokenMatch = configContent.match(/WHATSAPP_TOKEN=(.+)/);
if (whatsappTokenMatch && whatsappTokenMatch[1] && !whatsappTokenMatch[1].includes('your_')) {
  console.log('   ✅ WhatsApp configured');
} else {
  console.log('   ⚠️  WhatsApp not configured (optional)');
  console.log('   💡 To enable: Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to config.env');
}

console.log('\n🎯 Next Steps:');
console.log('1. Fix email configuration (see above)');
console.log('2. Run: node test-email.js');
console.log('3. Restart server: npm start');
console.log('4. Test by adding a student');
