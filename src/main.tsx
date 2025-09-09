import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ImpersonationProvider } from "@/hooks/useImpersonation";

// Initialize production services and console cleaners before loading app code
import './utils/productionConfig';
import './utils/consoleLogCleaner';
import './utils/consoleReplacer';
import { checkSupabaseConnectivity } from './utils/supabaseHealth';

import App from './App.tsx'

// Run a quick connectivity check for Supabase and log actionable advice
(async () => {
  try {
    // Dynamically import the client so we can read the runtime-derived URL without forcing initialization here
    const client = await import('./integrations/supabase/client');
    // @ts-ignore
    const url = client?.SUPABASE_URL || (client?.supabase?._supabaseUrl) || undefined;
    // Try other fallback: read from window runtime
    // @ts-ignore
    const runtime = typeof window !== 'undefined' ? (window.__RUNTIME_CONFIG || {}) : {};
    const runtimeUrl = runtime.NEXT_PUBLIC_SUPABASE_URL || runtime.VITE_SUPABASE_URL;
    const effectiveUrl = url || runtimeUrl || '';

    const anon = runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY || runtime.VITE_SUPABASE_ANON_KEY || undefined;
    const result = await checkSupabaseConnectivity(effectiveUrl, anon, 3000);
    if (!result.ok) {
      console.error('❌ Supabase connectivity check failed. Possible causes:');
      console.error('- Missing or incorrect NEXT_PUBLIC_SUPABASE_URL / ANON_KEY at runtime');
      console.error('- Supabase project CORS not allowing this origin (add your domain in Supabase project settings)');
      console.error('- Network/DNS issues or request blocked by browser (CSP, adblock, tracking protection)');
      console.error('Check that the runtime config file or environment variables are present and that the Supabase project allows requests from your domain.');
    } else {
      console.info('✅ Supabase connectivity OK');
    }
  } catch (e) {
    // Ignore — we don't want to block app startup
    console.warn('Supabase connectivity quick-check skipped or failed to run:', e);
  }
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ImpersonationProvider>
      <App />
    </ImpersonationProvider>
  </React.StrictMode>
);
