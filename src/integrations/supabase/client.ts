import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Prefer VITE_* vars but fall back to NEXT_PUBLIC_* ones if present
const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || ''
).toString();
const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
).toString();

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const supabaseOptions = typeof window !== 'undefined' ? {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
} : undefined;

const missingMessage = 'Supabase client not initialized: missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.';

let _supabase: ReturnType<typeof createClient<Database>> | null = null;

if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  _supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseOptions);
} else {
  // Create a safe proxy that throws with a helpful message only when used
  const handler: ProxyHandler<any> = {
    get() {
      return () => { throw new Error(missingMessage); };
    },
    apply() {
      throw new Error(missingMessage);
    }
  };
  // @ts-ignore
  _supabase = new Proxy({}, handler);
}

export const supabase = _supabase as unknown as ReturnType<typeof createClient<Database>>;
