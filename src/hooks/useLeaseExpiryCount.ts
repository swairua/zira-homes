import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useLeaseExpiryCount() {
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchExpiringLeases = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Try the Supabase RPC first (client-side). If it fails due to RLS or type errors, fallback to server endpoint.
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_lease_expiry_report', { p_start_date: null, p_end_date: null })
          .maybeSingle();

        if (rpcError) {
          // Log RPC error and attempt server endpoint fallback
          const formatted = (() => {
            try {
              if (!rpcError) return 'Unknown RPC error';
              if (typeof rpcError === 'string') return rpcError;
              const parts: string[] = [];
              if ((rpcError as any).message) parts.push((rpcError as any).message);
              if ((rpcError as any).details) parts.push((rpcError as any).details);
              if ((rpcError as any).hint) parts.push(`hint: ${(rpcError as any).hint}`);
              if (parts.length === 0) return JSON.stringify(rpcError);
              return parts.join(' | ');
            } catch (e) {
              return String(rpcError);
            }
          })();

          console.warn('RPC failed, attempting server endpoint fallback:', formatted);
          console.debug('Full RPC error object:', rpcError);

          // Fallback to server endpoint which uses service_role internally
          try {
            const url = '/api/leases/expiring';
            const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            const payload = await res.json();

            // normalize payload: either { kpis: { expiring_leases: N } } or [{ expiring_leases: N }]
            let count = 0;
            if (payload == null) {
              count = 0;
            } else if (Array.isArray(payload) && payload.length > 0 && payload[0].expiring_leases != null) {
              count = Number(payload[0].expiring_leases) || 0;
            } else if (payload.kpis && payload.kpis.expiring_leases != null) {
              count = Number(payload.kpis.expiring_leases) || 0;
            } else if (payload.expiring_leases != null) {
              count = Number(payload.expiring_leases) || 0;
            }

            setExpiringCount(count);
          } catch (fallbackErr) {
            console.error('Fallback server endpoint failed:', fallbackErr);
            console.debug('Full fallback error object:', fallbackErr);
            setExpiringCount(0);
          }
        } else {
          const kpis = rpcData?.kpis || null;
          const count = kpis?.expiring_leases ?? 0;
          setExpiringCount(Number(count) || 0);
        }
      } catch (err) {
        console.error('Error fetching lease expiry count (unexpected):', err && ((err as any).message || JSON.stringify(err)));
        console.debug('Full unexpected error object:', err);
        // Final fallback: try server endpoint
        try {
          const res = await fetch('/api/leases/expiring');
          const payload = await res.json();
          let count = 0;
          if (Array.isArray(payload) && payload.length > 0 && payload[0].expiring_leases != null) count = Number(payload[0].expiring_leases) || 0;
          else if (payload.kpis && payload.kpis.expiring_leases != null) count = Number(payload.kpis.expiring_leases) || 0;
          setExpiringCount(count);
        } catch (e) {
          setExpiringCount(0);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}
