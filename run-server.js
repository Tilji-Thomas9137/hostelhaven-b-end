// Simple server runner that won't exit
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting HostelHaven Backend Server...');
console.log('📍 Working Directory:', __dirname);
console.log('⏰ Started at:', new Date().toISOString());
console.log('');

const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});

serverProcess.on('exit', (code) => {
  console.log(`\n🛑 Server exited with code ${code}`);
  if (code !== 0) {
    console.log('🔄 Restarting server in 3 seconds...');
    setTimeout(() => {
      console.log('🔄 Restarting...');
      process.exit(1); // This will cause the parent process to restart
    }, 3000);
  }
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});

// Keep alive
setInterval(() => {
  // Just keep the process running
}, 1000);
