const fs = require('fs');
const path = require('path');

function checkConfiguration() {
  console.log('🔍 Checking HostelHaven backend configuration...\n');

  // Check if config.env exists
  const configPath = path.join(__dirname, '..', 'config.env');
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.env file not found!');
    console.log('📝 Creating a template config.env file...');
    
    const templateConfig = `# Server Configuration
NODE_ENV=development
PORT=3002

# Supabase Configuration - Replace with your actual values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_for_development
JWT_EXPIRE=30d`;

    fs.writeFileSync(configPath, templateConfig);
    console.log('✅ Template config.env created!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to https://supabase.com and create a new project');
    console.log('2. Go to Settings > API in your Supabase dashboard');
    console.log('3. Copy your Project URL and API keys');
    console.log('4. Update the values in backend/config.env');
    console.log('5. Run the database schema from supabase-schema.sql');
    console.log('6. Restart the server with: npm run dev\n');
    return false;
  }

  // Load environment variables
  require('dotenv').config({ path: configPath });

  // Check required environment variables
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName].includes('your_'));

  if (missingVars.length > 0) {
    console.log('⚠️  Configuration incomplete:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}: ${process.env[varName] || 'not set'}`);
    });
    console.log('\n📋 To complete setup:');
    console.log('1. Go to https://supabase.com and create a new project');
    console.log('2. Go to Settings > API in your Supabase dashboard');
    console.log('3. Update the values in backend/config.env');
    console.log('4. Run the database schema from supabase-schema.sql');
    console.log('5. Restart the server\n');
    console.log('🚀 Server will start in development mode with mock data...\n');
    return false;
  }

  console.log('✅ Configuration looks good!');
  console.log(`📡 Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 API Key: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...`);
  console.log('');
  return true;
}

module.exports = { checkConfiguration };

// Run check if called directly
if (require.main === module) {
  checkConfiguration();
}