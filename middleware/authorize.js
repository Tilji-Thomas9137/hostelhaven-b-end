const { supabase } = require('../config/supabase');

/**
 * Authorization middleware to check user roles
 * @param {string[]} allowedRoles - Array of roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // Get user from database using auth_uid
      let { data: user, error } = await supabase
        .from('users')
        .select('id, role, status, auth_uid, email')
        .eq('auth_uid', req.user.id)
        .maybeSingle();

      // Fallback: try matching by email if auth_uid not set yet
      if (error || !user) {
        const { data: byEmail } = await supabase
          .from('users')
          .select('id, role, status, auth_uid, email')
          .eq('email', req.user.email)
          .maybeSingle();

        if (byEmail) {
          user = byEmail;
          // Best-effort: persist auth_uid to avoid future fallbacks
          if (!user.auth_uid) {
            await supabase
              .from('users')
              .update({ auth_uid: req.user.id })
              .eq('id', user.id);
          }
        }
      }

      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'User not found in database'
        });
      }

      // Check if user account is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'User account is not active'
        });
      }

      // Check if user role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      // Add user role to request object for use in route handlers
      req.user.role = user.role;
      req.user.dbId = user.id;
      req.user.status = user.status;

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

/**
 * Middleware to check if user is staff (admin, warden, or operations assistant)
 */
const requireStaff = authorize(['admin', 'hostel_operations_assistant', 'warden']);

/**
 * Middleware to check if user is admin only
 */
const requireAdmin = authorize(['admin']);

/**
 * Middleware to check if user is student only
 */
const requireStudent = authorize(['student']);

/**
 * Middleware to check if user is parent only
 */
const requireParent = authorize(['parent']);

module.exports = {
  authorize,
  requireStaff,
  requireAdmin,
  requireStudent,
  requireParent
};
