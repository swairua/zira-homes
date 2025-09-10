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
        // Use server-side RPC which handles permissions and joins safely
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_lease_expiry_report').maybeSingle();
        if (rpcError) {
          // Format Supabase/PostgREST error into readable string
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

          console.error('Error fetching expiring leases (RPC):', formatted);
          // Log full object for debugging separately
          console.debug('Full RPC error object:', rpcError);

          setExpiringCount(0);
        } else {
          const kpis = rpcData?.kpis || null;
          const count = kpis?.expiring_leases ?? 0;
          setExpiringCount(Number(count) || 0);
        }
      } catch (err) {
        console.error('Error fetching lease expiry count (unexpected):', err && ((err as any).message || JSON.stringify(err)));
        console.debug('Full unexpected error object:', err);
        setExpiringCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}
