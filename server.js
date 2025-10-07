require('dotenv').config({ path: './config.env' });

// Check configuration
const { checkConfiguration, ensureBootstrapAdmin } = require('./scripts/check-config');
const isConfigured = checkConfiguration();

// Import server configuration
const { createApp, startServer } = require('./config/server');

// Create and start the server
const app = createApp();
const server = startServer(app);

// Ensure a single admin exists
(async () => {
  try {
    await ensureBootstrapAdmin();
  } catch (e) {
    console.warn('Admin bootstrap failed:', e.message);
  }
})();

module.exports = app; 