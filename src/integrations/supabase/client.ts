import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Prefer runtime config injected at host (window.__RUNTIME_CONFIG), then VITE_ / NEXT_PUBLIC_ envs
function readMeta(name: string) {
  try {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') || '' : '';
  } catch (e) { return ''; }
}

const runtime = (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG) ? (window as any).__RUNTIME_CONFIG : {};

const SUPABASE_URL = (
  runtime.VITE_SUPABASE_URL || runtime.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || readMeta('NEXT_PUBLIC_SUPABASE_URL') || ''
).toString();
const SUPABASE_PUBLISHABLE_KEY = (
  runtime.VITE_SUPABASE_ANON_KEY || runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || readMeta('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''
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
  try {
    // If running in browser, override rpc to use server-side proxy to avoid CORS issues
    if (typeof window !== 'undefined') {
      const originalRpc = (_supabase as any).rpc?.bind(_supabase);
      (_supabase as any).rpc = (fnName: string, params?: any) => {
        const call = async () => {
          try {
            const resp = await fetch(`/api/supabase/rpc/${encodeURIComponent(fnName)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params || {}),
            });
            const text = await resp.text();
            try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } }; } catch(e) { return { data: text, error: resp.ok ? null : { status: resp.status, text } }; }
          } catch (e) {
            if (originalRpc) return originalRpc(fnName, params);
            throw e;
          }
        };

        const p = call();
        // Attach compatibility methods used by supabase client
        (p as any).maybeSingle = async () => await p;
        (p as any).single = async () => await p;
        return p as any;
      };
    }
  } catch (e) {
    // ignore
  }
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
