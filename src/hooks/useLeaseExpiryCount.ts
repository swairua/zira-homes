import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { restSelect } from '@/integrations/supabase/restProxy';
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
        const propRes = await restSelect('properties', 'id', { or: `(owner_id.eq.${user.id},manager_id.eq.${user.id})` });
        if (propRes.error) {
          console.error('Error fetching properties for lease expiry:', propRes.error);
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        // Normalize property response
        let propData: any = propRes.data;
        if (!Array.isArray(propData)) {
          if (propData && typeof propData === 'object' && Array.isArray((propData as any).data)) propData = (propData as any).data;
          else if (propData == null || propData === '') propData = [];
          else propData = [propData];
        }

        const propertyIds = (propData || []).map((p: any) => p.id).filter(Boolean);
        if (propertyIds.length === 0) {
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        // Step 2: find units in those properties
        const unitsRes = await restSelect('units', 'id', { property_id: `in.(${propertyIds.join(',')})` });
        if (unitsRes.error) {
          console.error('Error fetching units for lease expiry:', unitsRes.error);
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        let unitsData: any = unitsRes.data;
        if (!Array.isArray(unitsData)) {
          if (unitsData && typeof unitsData === 'object' && Array.isArray((unitsData as any).data)) unitsData = (unitsData as any).data;
          else if (unitsData == null || unitsData === '') unitsData = [];
          else unitsData = [unitsData];
        }

        const unitIds = (unitsData || []).map((u: any) => u.id).filter(Boolean);
        if (unitIds.length === 0) {
          setExpiringCount(0);
          setLoading(false);
          return;
        }

        // Step 3: count active leases on those units expiring within the next 90 days
        const leasesRes = await restSelect('leases', 'id', { unit_id: `in.(${unitIds.join(',')})`, status: 'eq.active', lease_end_date: `gte.${new Date().toISOString()}`, lease_end_date2: `lte.${ninetyDaysFromNow.toISOString()}` });
        if (leasesRes.error) {
          console.error('Error fetching expiring leases:', leasesRes.error);
          setExpiringCount(0);
        } else {
          let leasesData: any = leasesRes.data;
          if (!Array.isArray(leasesData)) {
            if (leasesData && typeof leasesData === 'object' && Array.isArray((leasesData as any).data)) leasesData = (leasesData as any).data;
            else if (leasesData == null || leasesData === '') leasesData = [];
            else leasesData = [leasesData];
          }
          setExpiringCount(Array.isArray(leasesData) ? leasesData.length : 0);
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
