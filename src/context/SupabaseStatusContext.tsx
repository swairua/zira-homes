import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkSupabaseConnectivity } from '@/utils/supabaseHealth';

export type SupabaseStatus = { ok: boolean; reason?: string; status?: number } | null;

const SupabaseStatusContext = createContext<SupabaseStatus | undefined>(undefined);

export const SupabaseStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SupabaseStatus>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Read runtime config from window if available
        // @ts-ignore
        const runtime = typeof window !== 'undefined' ? (window.__RUNTIME_CONFIG || {}) : {};
        const url = runtime.NEXT_PUBLIC_SUPABASE_URL || runtime.VITE_SUPABASE_URL || '';
        const anon = runtime.NEXT_PUBLIC_SUPABASE_ANON_KEY || runtime.VITE_SUPABASE_ANON_KEY || undefined;
        const res = await checkSupabaseConnectivity(url, anon, 3000);
        if (mounted) setStatus(res as SupabaseStatus);
      } catch (e) {
        if (mounted) setStatus({ ok: false, reason: 'exception' });
      }
    })();

    return () => { mounted = false; };
  }, []);

  return (
    <SupabaseStatusContext.Provider value={status}>
      {children}
    </SupabaseStatusContext.Provider>
  );
};

export function useSupabaseStatus() {
  const ctx = useContext(SupabaseStatusContext);
  if (ctx === undefined) throw new Error('useSupabaseStatus must be used within SupabaseStatusProvider');
  return ctx;
}
