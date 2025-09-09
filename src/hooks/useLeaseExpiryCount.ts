import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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

        // Avoid complex `.or` on nested relations which may fail parsing on the server.
        // Step 1: find properties owned or managed by user
        const { data: properties, error: propError } = await supabase
          .from('properties')
          .select('id')
          .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`);

        if (propError) {
          try { console.error('Error fetching properties for lease expiry:', JSON.stringify(propError, Object.getOwnPropertyNames(propError), 2)); } catch (e) { console.error('Error fetching properties for lease expiry (non-serializable):', propError); }
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        const propertyIds = (properties || []).map((p: any) => p.id).filter(Boolean);
        if (propertyIds.length === 0) {
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        // Step 2: find units in those properties
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .in('property_id', propertyIds);

        if (unitsError) {
          try { console.error('Error fetching units for lease expiry:', JSON.stringify(unitsError, Object.getOwnPropertyNames(unitsError), 2)); } catch (e) { console.error('Error fetching units for lease expiry (non-serializable):', unitsError); }
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        const unitIds = (units || []).map((u: any) => u.id).filter(Boolean);
        if (unitIds.length === 0) {
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        // Step 3: count active leases on those units expiring within the next 90 days
        const { data: leasesData, error: leasesError, count } = await supabase
          .from('leases')
          .select('id', { count: 'exact' })
          .in('unit_id', unitIds)
          .eq('status', 'active')
          .gte('lease_end_date', new Date().toISOString())
          .lte('lease_end_date', ninetyDaysFromNow.toISOString());

        if (leasesError) {
          try { console.error('Error fetching expiring leases:', JSON.stringify(leasesError, Object.getOwnPropertyNames(leasesError), 2)); } catch (e) { console.error('Error fetching expiring leases (non-serializable):', leasesError); }
          setExpiringCount(0);
        } else {
          setExpiringCount(typeof count === 'number' ? count : (Array.isArray(leasesData) ? leasesData.length : 0));
        }
      } catch (error) {
        try {
          console.error('Error fetching lease expiry count:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } catch (e) {
          console.error('Error fetching lease expiry count (non-serializable):', error);
        }
        setExpiringCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}
