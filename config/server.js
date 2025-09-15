const express = require('express');
require('dotenv').config({ path: './config.env' });

// Import configurations
const { configureMiddleware } = require('./middleware');
const { configureRoutes } = require('./routes');
const { errorHandler } = require('../middleware/errorHandler');

/**
 * Create and configure Express application
 */
const createApp = () => {
  const app = express();

  // Configure middleware
  configureMiddleware(app);

  // Configure routes
  configureRoutes(app);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};

/**
 * Start the server
 */
const startServer = (app) => {
  const PORT = process.env.PORT || 3002;

  const server = app.listen(PORT, () => {
    console.log(`🚀 HostelHaven API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
};

module.exports = {
  createApp,
  startServer
};
