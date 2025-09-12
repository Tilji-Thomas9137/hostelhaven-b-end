const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
require('dotenv').config({ path: './config.env' });

// Check configuration
const { checkConfiguration } = require('./scripts/check-config');
const isConfigured = checkConfiguration();

// Import routes
const authRoutes = require('./routes/auth');
const paymentsRoutes = require('./routes/payments');
const complaintsRoutes = require('./routes/complaints');
const leaveRequestsRoutes = require('./routes/leave-requests');
const roomsRoutes = require('./routes/rooms');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const roomAllocationsRoutes = require('./routes/room-allocations');
const roomAllocationRoutes = require('./routes/room-allocation');
const operationsRoutes = require('./routes/operations');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting (enabled only in production to avoid interfering with local dashboards)
let limiter;
let speedLimiter;
if (process.env.NODE_ENV === 'production') {
  limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000 / 60)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/auth/me'
  });

  speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 200, // higher threshold in production
    delayMs: () => 250
  });

  app.use(limiter);
  app.use(speedLimiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  // Only log errors (4xx and 5xx responses)
  app.use(morgan('dev', {
    skip: function (req, res) { return res.statusCode < 400; }
  }));
} else {
  app.use(morgan('combined', {
    skip: function (req, res) { return res.statusCode < 400; }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'HostelHaven API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/leave-requests', leaveRequestsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/room-allocations', roomAllocationsRoutes);
app.use('/api/room-allocation', roomAllocationRoutes);
app.use('/api/operations', operationsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HostelHaven API Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app; 