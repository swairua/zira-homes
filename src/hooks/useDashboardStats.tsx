import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  activeTenants: number;
  monthlyRevenue: number;
  occupancyRate: number;
  maintenanceRequests: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    occupancyRate: 0,
    maintenanceRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch properties count
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id");

      if (propertiesError) throw propertiesError;

      // Fetch units data
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, status, rent_amount");

      if (unitsError) throw unitsError;

      // Fetch tenants count
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id");

      if (tenantsError) throw tenantsError;

      // Calculate stats
      const totalProperties = properties?.length || 0;
      const totalUnits = units?.length || 0;
      const occupiedUnits = units?.filter(unit => unit.status === "occupied").length || 0;
      const vacantUnits = units?.filter(unit => unit.status === "vacant").length || 0;
      const activeTenants = tenants?.length || 0;
      const monthlyRevenue = units
        ?.filter(unit => unit.status === "occupied")
        .reduce((sum, unit) => sum + (unit.rent_amount || 0), 0) || 0;
      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      // Fetch maintenance requests count
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id")
        .eq("status", "pending");

      if (maintenanceError) throw maintenanceError;
      const maintenanceRequests = maintenanceData?.length || 0;
      setStats({
        totalProperties,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        activeTenants,
        monthlyRevenue,
        occupancyRate,
        maintenanceRequests,
      });

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, refetch: fetchStats };
}