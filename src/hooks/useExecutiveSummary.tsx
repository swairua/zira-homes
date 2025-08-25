import { useQuery } from '@tanstack/react-query';
import { getReportData } from '@/lib/reporting/queries';
import { ReportFilters } from '@/lib/reporting/types';

export const useExecutiveSummary = () => {
  // Get current year data for financial summary
  const currentYear = new Date().getFullYear();
  const ytdFilters: ReportFilters = {
    periodPreset: 'ytd',
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().split('T')[0]
  };

  // Fetch rent collection data (YTD) for revenue
  const { data: financialData, isLoading: isLoadingFinancial } = useQuery({
    queryKey: ['executive-summary-financial', ytdFilters],
    queryFn: () => getReportData('rent_collection', ytdFilters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch expense data (YTD) for operating expenses
  const { data: expenseData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['executive-summary-expenses', ytdFilters],
    queryFn: () => getReportData('expense_summary', ytdFilters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch outstanding balances (current)
  const { data: outstandingData, isLoading: isLoadingOutstanding } = useQuery({
    queryKey: ['executive-summary-outstanding'],
    queryFn: () => getReportData('outstanding_balances', {
      periodPreset: 'current_period',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const isLoading = isLoadingFinancial || isLoadingExpenses || isLoadingOutstanding;

  // Extract KPIs and calculate NOI properly
  const totalRevenue = financialData?.kpis?.total_collected || 0;
  const totalOperatingExpenses = expenseData?.kpis?.total_expenses || 0;
  const netOperatingIncome = totalRevenue - totalOperatingExpenses; // Proper NOI calculation
  const outstandingAmount = outstandingData?.kpis?.total_outstanding || 0;

  return {
    totalRevenue,
    netOperatingIncome,
    outstandingAmount,
    totalOperatingExpenses,
    isLoading,
    hasData: !isLoading && (financialData || outstandingData || expenseData)
  };
};