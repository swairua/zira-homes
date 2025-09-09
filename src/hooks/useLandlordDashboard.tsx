import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PropertyStats {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  monthly_revenue: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  payment_reference?: string;
  tenant_name: string;
  property_name: string;
  unit_number: string;
}

interface PendingMaintenance {
  id: string;
  title: string;
  priority: string;
  submitted_date: string;
  category: string;
  status: string;
  property_name: string;
  unit_number?: string;
  tenant_name?: string;
}

interface LandlordDashboardData {
  property_stats: PropertyStats | null;
  recent_payments: RecentPayment[];
  pending_maintenance: PendingMaintenance[];
}

export function useLandlordDashboard() {
  const [data, setData] = useState<LandlordDashboardData>({
    property_stats: null,
    recent_payments: [],
    pending_maintenance: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('get_landlord_dashboard_data')
        .maybeSingle();

      if (rpcError) {
        throw rpcError;
      }

      // Validate and normalize result data
      const validatedData: LandlordDashboardData = {
        property_stats: (result as any)?.property_stats && typeof (result as any).property_stats === 'object' 
          ? {
              total_properties: Number((result as any).property_stats.total_properties) || 0,
              total_units: Number((result as any).property_stats.total_units) || 0,
              occupied_units: Number((result as any).property_stats.occupied_units) || 0,
              monthly_revenue: Number((result as any).property_stats.monthly_revenue) || 0,
            }
          : null,
        recent_payments: Array.isArray((result as any)?.recent_payments) ? (result as any).recent_payments : [],
        pending_maintenance: Array.isArray((result as any)?.pending_maintenance) ? (result as any).pending_maintenance : []
      };
      
      setData(validatedData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData
  };
}