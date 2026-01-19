// ===========================================
// Supabase Client Configuration
// ===========================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

// Using 'any' for database types since we use service_role key
// and have full control over the schema via migrations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

// Singleton Supabase client with service role (full access)
let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseClient;
}

export { SupabaseClient };
