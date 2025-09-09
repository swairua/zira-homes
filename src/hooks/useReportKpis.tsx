import { useQuery } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { rpcProxy, restSelect } from '@/integrations/supabase/restProxy';
import { getReportsForRole } from '@/lib/reporting/config';
import { useRole } from '@/context/RoleContext';

interface ReportKpisData {
  reportsGenerated: number;
  collectionRate: number;
  scheduledReports: number;
  dataCoverage: number;
}

export const useReportKpis = () => {
  const { effectiveRole } = useRole();

  return useQuery({
    queryKey: ['report-kpis', effectiveRole],
    queryFn: async (): Promise<ReportKpisData> => {
      try {
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const currentMonthEnd = new Date().toISOString().split('T')[0];

        const execRes = await rpcProxy('get_executive_summary_report', { p_start_date: currentMonthStart, p_end_date: currentMonthEnd, p_include_tenant_scope: true });
        if (execRes.error) console.warn('Error fetching executive data for KPIs:', execRes.error);
        const executiveData = execRes.data;

        // Fetch report_runs for the month and count locally
        const reportsRes = await restSelect('report_runs', 'id', { generated_at: `gte.${currentMonthStart}`, generated_at2: `lt.${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()}` });
        if (reportsRes.error) console.warn('Error fetching report_runs:', reportsRes.error);
        let reportsData: any = reportsRes.data || [];
        if (!Array.isArray(reportsData)) {
          if (reportsData && typeof reportsData === 'object' && Array.isArray((reportsData as any).data)) reportsData = (reportsData as any).data;
          else if (reportsData == null || reportsData === '') reportsData = [];
          else reportsData = [reportsData];
        }

        const reportsCount = Array.isArray(reportsData) ? reportsData.length : 0;

        // Count total properties
        const propertiesRes = await restSelect('properties', 'id');
        let propertiesData: any = propertiesRes.data || [];
        if (!Array.isArray(propertiesData)) {
          if (propertiesData && typeof propertiesData === 'object' && Array.isArray((propertiesData as any).data)) propertiesData = (propertiesData as any).data;
          else if (propertiesData == null || propertiesData === '') propertiesData = [];
          else propertiesData = [propertiesData];
        }
        const propertiesCount = Array.isArray(propertiesData) ? propertiesData.length : 0;

        // Market data
        const marketRes = await rpcProxy('get_market_rent_report', {});
        if (marketRes.error) console.warn('Error fetching market data for KPIs:', marketRes.error);
        const marketData = marketRes.data;

        let roleForReports = effectiveRole || 'tenant';
        if (roleForReports === 'manager' || roleForReports === 'agent') roleForReports = 'landlord';
        const availableReportsCount = getReportsForRole(roleForReports as any).length;

        const collectionRate = (executiveData as any)?.kpis?.collection_rate || 0;
        const propertiesAnalyzed = (marketData as any)?.kpis?.properties_analyzed || 0;
        const totalPropertiesFromMarket = (marketData as any)?.kpis?.total_properties || propertiesCount || 1;
        const dataCoverage = Math.round((propertiesAnalyzed / totalPropertiesFromMarket) * 100);

        return {
          reportsGenerated: reportsCount || 0,
          collectionRate,
          scheduledReports: availableReportsCount,
          dataCoverage: Math.min(Math.max(dataCoverage, 0), 100)
        };
      } catch (error) {
        console.error('Error fetching report KPIs:', error);
        return { reportsGenerated: 0, collectionRate: 0, scheduledReports: 0, dataCoverage: 0 };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};
