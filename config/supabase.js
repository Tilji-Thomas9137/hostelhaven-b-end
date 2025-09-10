const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if we're in development and provide helpful error messages
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please set the following in your backend/config.env file:');
  console.error('- SUPABASE_URL=your_supabase_project_url');
  console.error('- SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.error('- SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key');
  console.error('');
  console.error('You can find these values in your Supabase project settings > API');
  
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Running in development mode without Supabase connection');
    // Create mock clients for development
    const mockClient = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') }),
        getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') }),
        signOut: () => Promise.resolve({ error: null }),
        signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signInWithOAuth: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        exchangeCodeForSession: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        resetPasswordForEmail: () => Promise.resolve({ error: null }),
        updateUser: () => Promise.resolve({ error: null }),
        refreshSession: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
        insert: () => ({ select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }) }),
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: new Error('Supabase not configured') }) })
      })
    };
    
    module.exports = {
      supabase: mockClient,
      supabaseAdmin: mockClient
    };
    return;
  } else {
    throw new Error('Missing required Supabase environment variables');
  }
}

// Regular client for user operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for admin operations (if service key is available)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

console.log('✅ Supabase client initialized successfully');

module.exports = {
  supabase,
  supabaseAdmin
};