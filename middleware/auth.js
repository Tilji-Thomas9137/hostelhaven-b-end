const { supabase, supabaseAdmin } = require('../config/supabase');
const { AuthenticationError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token is required');
    }

    const token = authHeader.substring(7);
    console.log('🔐 Auth middleware: Verifying token for request to:', req.path);

    // Verify the token with Supabase using admin client for reliability
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error('❌ Token verification error:', error.message);
      // Handle network timeout errors more gracefully
      if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
        console.warn('Supabase connection timeout, attempting to verify user from database');
        
        // Try to decode the JWT token manually to get user ID
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            const userId = payload.sub;
            
            if (userId) {
              // Create a mock user object for database verification
              const mockUser = { id: userId, email: payload.email };
              
              // Verify user exists in our database
              const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('*')
                .eq('auth_uid', userId)
                .single();
              
              if (!dbError && dbUser) {
                // Use mock user for verification
                req.user = mockUser;
                req.userProfile = dbUser;
                return next();
              }
            }
          }
        } catch (decodeError) {
          console.error('Failed to decode token:', decodeError);
        }
        
        throw new AuthenticationError('Connection timeout. Please try again.');
      }
      
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

    console.log('✅ Token verified successfully for user:', user.email);

    // Check if user is suspended and verify admission registry linkage for students
    let userProfile = req.userProfile;
    let profileError = null;
    
    if (!userProfile) {
      const { data: profile, error: error } = await supabase
        .from('users')
        .select('status, role')
        .eq('auth_uid', user.id)
        .single();
      userProfile = profile;
      profileError = error;
    }

    if (profileError) {
      // Allow through if no profile exists yet (PGRST116 or equivalent message)
      const isNoRows = profileError.code === 'PGRST116' ||
        (typeof profileError.message === 'string' && (
          profileError.message.includes('No rows') ||
          profileError.message.includes('multiple (or no) rows returned')
        ));
      if (!isNoRows) {
        console.error('Error fetching user status:', profileError);
        throw new AuthenticationError('Unable to verify user status');
      }
    }

    if (userProfile?.status === 'suspended') {
      throw new AuthenticationError('Your account has been suspended. Please contact an administrator.');
    }

    // Check if student has admission registry linkage (skip for specific routes)
    const path = typeof req.path === 'string' ? req.path : '';
    const isParentRoute = path.startsWith('/api/parents');
    const allowedWithoutActivation = [
      '/api/student-profile', // students should be able to query their profile existence
      '/api/user-profiles/save', // allow creating/updating personal details
      '/api/auth/me',
      '/api/notifications' // read notifications
    ];
    const skipActivation = allowedWithoutActivation.some(p => path.startsWith(p));
    if (!isParentRoute && !skipActivation && userProfile?.role === 'student') {
      const { data: studentProfile, error: studentError } = await supabase
        .from('user_profiles')
        .select('admission_number, profile_status, status')
        .eq('user_id', userProfile.id) // Use the users table id, not auth_uid
        .single();

      if (studentError || !studentProfile || studentProfile.profile_status !== 'active') {
        throw new AuthenticationError('Your account is not yet activated by hostel staff. Please contact the hostel administration.');
      }
    }

    // Attach user to request object (normalized minimal shape)
    req.user = { id: user.id, email: user.email };
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