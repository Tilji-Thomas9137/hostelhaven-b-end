const { supabase } = require('../config/supabase');
const { AuthenticationError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token is required');
    }

    const token = authHeader.substring(7);

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      // Handle specific error cases
      if (error.message.includes('JWT expired') || error.message.includes('expired')) {
        throw new AuthenticationError('Session has expired. Please log in again.');
      } else if (error.message.includes('Invalid JWT') || error.message.includes('invalid')) {
        throw new AuthenticationError('Invalid token. Please log in again.');
      } else {
        throw new AuthenticationError('Authentication failed: ' + error.message);
      }
    }

    if (!user) {
      throw new AuthenticationError('User not found. Please log in again.');
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: error.message
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid token'
    });
  }
};

module.exports = {
  authMiddleware
};