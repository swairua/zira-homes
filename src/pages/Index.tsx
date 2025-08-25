import React, { Suspense } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { RecentActivityAlerts } from "@/components/dashboard/RecentActivityAlerts";
import { OptimizedStatsCards } from "@/components/optimized/OptimizedStatsCards";
import { OptimizedChartsSection } from "@/components/optimized/OptimizedChartsSection";
import { useLandlordDashboard } from "@/hooks/useLandlordDashboard";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useRouteTitle } from "@/hooks/useRouteTitle";
import { HealthCheckBanner } from "@/components/HealthCheckBanner";

export default function Index() {
  useRouteTitle();
  const { data, loading, error } = useLandlordDashboard();

  // Extract dashboard stats safely
  const stats = data?.property_stats ? {
    totalProperties: data.property_stats.total_properties,
    totalUnits: data.property_stats.total_units,
    occupiedUnits: data.property_stats.occupied_units,
    vacantUnits: data.property_stats.total_units - data.property_stats.occupied_units,
    monthlyRevenue: data.property_stats.monthly_revenue,
    occupancyRate: data.property_stats.total_units > 0 
      ? (data.property_stats.occupied_units / data.property_stats.total_units) * 100 
      : 0,
    totalExpenses: 0, // Will be fetched separately
    netIncome: data.property_stats.monthly_revenue,
    activeTenants: data.property_stats.occupied_units, // Use occupied units as active tenants
    maintenanceRequests: data?.pending_maintenance?.length || 0
  } : null;

  // Transform chart data to expected format
  const chartData = data?.recent_payments?.map((payment, index) => ({
    month: new Date(payment.payment_date).toLocaleDateString('en-US', { month: 'short' }),
    revenue: payment.amount,
    expenses: 0, // Placeholder
    profit: payment.amount
  })) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
          <LoadingSkeleton type="card" count={4} />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <CardTitle className="text-xl font-semibold text-destructive mb-2">Dashboard Error</CardTitle>
                <p className="text-muted-foreground">
                  {error || "Failed to load dashboard data"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        {/* Health Check Banner */}
        <HealthCheckBanner />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome to Zira Homes property management system
          </p>
        </div>
        
        {/* KPI Summary Cards - Using optimized version with actual data */}
        <Suspense fallback={<LoadingSkeleton type="card" count={4} />}>
          <OptimizedStatsCards stats={stats} isLoading={loading} />
        </Suspense>
        
        {/* Charts Section */}
        <Suspense fallback={<LoadingSkeleton type="chart" />}>
          <OptimizedChartsSection chartData={chartData} isLoading={loading} />
        </Suspense>
        
        {/* Recent Activity Section */}
        <Suspense fallback={<LoadingSkeleton type="list" />}>
          <RecentActivityAlerts />
        </Suspense>
        
        {/* Recent Payments Table */}
        <Suspense fallback={<LoadingSkeleton type="table" />}>
          <RecentPayments />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}