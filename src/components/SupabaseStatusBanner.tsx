import React from 'react';
import { useSupabaseStatus } from '@/context/SupabaseStatusContext';

export const SupabaseStatusBanner: React.FC = () => {
  const status = useSupabaseStatus();

  if (status === null || status.ok) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'your site';

  const message = (() => {
    switch (status.reason) {
      case 'missing_url':
        return 'Supabase is not configured for this environment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to runtime config or environment.';
      case 'timeout':
      case 'network':
      case 'opaque':
        return `Unable to reach Supabase from ${origin}. This is usually caused by network/CORS restrictions or ad-blockers. Ensure your Supabase project allows requests from ${origin} (Project Settings → API → Allowed origins).`;
      case 'http_error':
        return `Supabase responded with HTTP status ${status.status}. Check that your anon key is correct and that CORS allows this origin.`;
      default:
        return 'Unknown Supabase connectivity issue. Check console for details.';
    }
  })();

  return (
    <div style={{ background: '#ffe6e6', color: '#6b0505', padding: '12px 16px', border: '1px solid #ffbbbb', position: 'sticky', top: 0, zIndex: 9999 }}>
      <strong>Supabase connection problem:</strong>&nbsp;{message}
      <div style={{ marginTop: 6 }}>
        <small>
          Tips: 1) Add your origin to Supabase allowed origins. 2) Ensure runtime-config.json or environment vars are present. 3) Disable ad-blocker/Tracking Prevention for testing.
        </small>
      </div>
    </div>
  );
};
