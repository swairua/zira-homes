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
        // Get leases expiring in the next 90 days
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

        const { data, error } = await supabase
          .from('leases')
          .select(`
            id,
            lease_end_date,
            status,
            units!inner (
              property_id,
              properties!inner (
                owner_id,
                manager_id
              )
            )
          `)
          .or(`units.properties.owner_id.eq.${user.id},units.properties.manager_id.eq.${user.id}`)
          .eq('status', 'active')
          .gte('lease_end_date', new Date().toISOString())
          .lte('lease_end_date', ninetyDaysFromNow.toISOString());

        if (error) {
          console.error('Error fetching expiring leases:', error);
          setExpiringCount(0);
        } else {
          setExpiringCount(data?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching lease expiry count:', error);
        setExpiringCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}