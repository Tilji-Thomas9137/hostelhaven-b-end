const { supabase } = require('../config/supabase');

/**
 * Authentication middleware
 * Validates JWT token from Authorization header
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid authorization header found'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const authorizeRoles = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      // Get user profile from database to check role
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error || !userProfile) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'User profile not found'
        });
      }

      if (!allowedRoles.includes(userProfile.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `Role '${userProfile.role}' is not authorized for this operation`
        });
      }

      req.userRole = userProfile.role;
      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      return res.status(500).json({
        error: 'Authorization error',
        message: 'Internal server error during authorization'
      });
    }
  };
};

/**
 * Admin-only middleware
 */
const adminOnly = authorizeRoles(['admin']);

/**
 * Manager and Admin middleware
 */
const managerAndAdmin = authorizeRoles(['admin', 'manager']);

/**
 * Staff and above middleware
 */
const staffAndAbove = authorizeRoles(['admin', 'manager', 'staff']);

/**
 * Optional authentication middleware
 * Similar to authMiddleware but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = user;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

module.exports = {
  authMiddleware,
  authorizeRoles,
  adminOnly,
  managerAndAdmin,
  staffAndAbove,
  optionalAuth
}; 