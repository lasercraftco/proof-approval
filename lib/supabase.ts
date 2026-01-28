import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure this module only runs on server
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase.ts cannot be imported on client side. Use server components or API routes.');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Admin client with service role key (for server-side operations only)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Default export for convenience
export default supabaseAdmin;
