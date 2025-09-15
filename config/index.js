/**
 * Configuration index file
 * Centralizes all configuration exports
 */

module.exports = {
  // Server configuration
  ...require('./server'),
  
  // Middleware configuration
  ...require('./middleware'),
  
  // Routes configuration
  ...require('./routes')
};
