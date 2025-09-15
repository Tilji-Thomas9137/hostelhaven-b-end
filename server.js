require('dotenv').config({ path: './config.env' });

// Check configuration
const { checkConfiguration } = require('./scripts/check-config');
const isConfigured = checkConfiguration();

// Import server configuration
const { createApp, startServer } = require('./config/server');

// Create and start the server
const app = createApp();
const server = startServer(app);

module.exports = app; 