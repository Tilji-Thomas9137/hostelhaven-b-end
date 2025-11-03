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
  const messagesRoutes = require('../routes/messages');
  const adminRoutes = require('../routes/admin');
  const roomAllocationsRoutes = require('../routes/room-allocations');
  const roomAllocationRoutes = require('../routes/room-allocation');
  const operationsRoutes = require('../routes/operations');
  const aadharVerificationRoutes = require('../routes/aadhar-verification');
  const userProfilesRoutes = require('../routes/user-profiles');
  const hostelAssistantRoutes = require('../routes/staff'); // Renamed from staff to hostel_assistant
  const parentsRoutes = require('../routes/parents');
  const parcelsRoutes = require('../routes/parcels');
  const feedbackRoutes = require('../routes/feedback');
  const staffManagementRoutes = require('../routes/staff-management');
  const admissionRegistryRoutes = require('../routes/admission-registry');
  const roomManagementRoutes = require('../routes/room-management');
  const roomRequestsRoutes = require('../routes/room-requests');
  const parentVerificationRoutes = require('../routes/parent-verification');
  const parcelManagementRoutes = require('../routes/parcel-management');
  const cleaningManagementRoutes = require('../routes/cleaning-management');
  const cleaningRequestsRoutes = require('../routes/cleaning-requests');
  const adminStudentsRoutes = require('../routes/admin-students');
  const studentProfileRoutes = require('../routes/student-profile');
  const authHooksRoutes = require('../routes/auth-hooks');
  const studentCleaningRequestsRoutes = require('../routes/student-cleaning-requests');
  const studentLeaveRequestsRoutes = require('../routes/student-leave-requests');
  const studentComplaintsRoutes = require('../routes/student-complaints');
  const razorpayRoutes = require('../routes/razorpay');
  const outpassRoutes = require('../routes/outpass');

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
  app.use('/api/messages', messagesRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/room-allocations', roomAllocationsRoutes);
  app.use('/api/room-allocation', roomAllocationRoutes);
  app.use('/api/operations', operationsRoutes);
  app.use('/api/aadhar-verification', aadharVerificationRoutes);
  app.use('/api/user-profiles', userProfilesRoutes);
  app.use('/api/hostel_assistant', hostelAssistantRoutes);
  app.use('/api/parents', parentsRoutes);
  app.use('/api/parcels', parcelsRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/staff-management', staffManagementRoutes);
  app.use('/api/admission-registry', admissionRegistryRoutes);
  app.use('/api/room-management', roomManagementRoutes);
  app.use('/api/room-requests', roomRequestsRoutes);
  app.use('/api/parent-verification', parentVerificationRoutes);
  app.use('/api/parcel-management', parcelManagementRoutes);
  app.use('/api/cleaning-management', cleaningManagementRoutes);
  app.use('/api/cleaning-requests', cleaningRequestsRoutes);
  app.use('/api/admin/students', adminStudentsRoutes);
  // Supabase Auth Hooks endpoint (Signup/Invite)
  app.use('/api/auth-hooks', authHooksRoutes);
  // Student Profile endpoint
  app.use('/api/student-profile', studentProfileRoutes);
  // Student-specific endpoints
  app.use('/api/student-cleaning-requests', studentCleaningRequestsRoutes);
  app.use('/api/student-leave-requests', studentLeaveRequestsRoutes);
  app.use('/api/student-complaints', studentComplaintsRoutes);
  // Razorpay payment endpoints
  app.use('/api/razorpay', razorpayRoutes);
  // Outpass endpoints
  app.use('/api/outpass', outpassRoutes);

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
