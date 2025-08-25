import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ReportKpisData {
  reportsGenerated: number;
  collectionRate: number;
  scheduledReports: number;
  dataCoverage: number;
}

export const useReportKpis = () => {
  return useQuery({
    queryKey: ['report-kpis'],
    queryFn: async (): Promise<ReportKpisData> => {
      try {
        // Fetch collection rate from rent collection report
        const { data: collectionData } = await supabase.rpc('get_rent_collection_report', {
          p_start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          p_end_date: new Date().toISOString().split('T')[0]
        });

        // Count total properties for data coverage
        const { count: propertiesCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        // Count total units for data coverage calculation
        const { count: unitsCount } = await supabase
          .from('units')
          .select('*', { count: 'exact', head: true });

        // Get market rent data
        const { data: marketData } = await supabase.rpc('get_market_rent_report');

        const collectionRate = (collectionData as any)?.kpis?.collection_rate || 0;
        const propertiesAnalyzed = (marketData as any)?.kpis?.properties_analyzed || 0;
        const dataCoverage = propertiesCount ? Math.round((propertiesAnalyzed / propertiesCount) * 100) : 0;

        return {
          reportsGenerated: 12, // Static for now - could be implemented with report_runs table
          collectionRate,
          scheduledReports: 4, // Static for now - represents available report types
          dataCoverage
        };
      } catch (error) {
        console.error('Error fetching report KPIs:', error);
        return {
          reportsGenerated: 0,
          collectionRate: 0,
          scheduledReports: 0,
          dataCoverage: 0
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};