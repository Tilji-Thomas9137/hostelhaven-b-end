#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 HostelHaven Environment Setup');
console.log('================================\n');

console.log('❌ Current Issue:');
console.log('Your Supabase URL "dwiwsmhbamhpbugcjqdx.supabase.co" is invalid');
console.log('This is causing the "Failed to submit leave request" error\n');

console.log('✅ Solution:');
console.log('1. Go to https://supabase.com and create a new project');
console.log('2. Get your project credentials from Settings > API');
console.log('3. Update the config.env file with your real credentials\n');

console.log('📝 Required Environment Variables:');
console.log('- SUPABASE_URL (your project URL)');
console.log('- SUPABASE_ANON_KEY (your anon key)');
console.log('- SUPABASE_SERVICE_ROLE_KEY (your service role key)\n');

console.log('🔍 To fix this:');
console.log('1. Edit backend/config.env');
console.log('2. Replace the placeholder values with your actual Supabase credentials');
console.log('3. Restart your backend server\n');

console.log('💡 Example config.env:');
console.log('SUPABASE_URL=https://your-new-project-id.supabase.co');
console.log('SUPABASE_ANON_KEY=your_actual_anon_key_here');
console.log('SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here\n');

console.log('🚀 After updating:');
console.log('- Restart your backend server');
console.log('- Try submitting a leave request again');
console.log('- It should work properly!\n');

// Check if config.env exists and show current values
const configPath = path.join(__dirname, 'config.env');
if (fs.existsSync(configPath)) {
  console.log('📁 Current config.env location:', configPath);
  console.log('⚠️  Please update this file with your real Supabase credentials');
} else {
  console.log('❌ config.env file not found at:', configPath);
  console.log('Please create it with the required environment variables');
}
