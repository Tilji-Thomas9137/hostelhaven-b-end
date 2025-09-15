/**
 * Configure all API routes
 */
const configureRoutes = (app) => {
  // Import routes
  const authRoutes = require('../routes/auth');
  const paymentsRoutes = require('../routes/payments');
  const complaintsRoutes = require('../routes/complaints');
  const leaveRequestsRoutes = require('../routes/leave-requests');
  const roomsRoutes = require('../routes/rooms');
  const notificationsRoutes = require('../routes/notifications');
  const adminRoutes = require('../routes/admin');
  const roomAllocationsRoutes = require('../routes/room-allocations');
  const roomAllocationRoutes = require('../routes/room-allocation');
  const operationsRoutes = require('../routes/operations');
  const aadharVerificationRoutes = require('../routes/aadhar-verification');
  const userProfilesRoutes = require('../routes/user-profiles');

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
  app.use('/api/aadhar-verification', aadharVerificationRoutes);
  app.use('/api/user-profiles', userProfilesRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  });
};

module.exports = {
  configureRoutes
};
