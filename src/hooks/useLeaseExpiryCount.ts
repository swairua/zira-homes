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
          console.error('Error fetching expiring leases (RPC):', rpcError);
          setExpiringCount(0);
        } else {
          const kpis = rpcData?.kpis || null;
          const count = kpis?.expiring_leases ?? 0;
          setExpiringCount(Number(count) || 0);
        }
      } catch (err) {
        console.error('Error fetching lease expiry count (unexpected):', err);
        setExpiringCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}
