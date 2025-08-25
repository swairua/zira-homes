import { supabase } from "@/integrations/supabase/client";
import { ReportData, ReportFilters } from "./types";

// Type for the SQL function response
interface ReportResponse {
  kpis: Record<string, number>;
  charts: Record<string, any[]>;
  table: any[];
}

const reportQueries = {
  rent_collection: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching rent collection report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_rent_collection_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching rent collection report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      console.log('Rent collection report response:', reportResponse);
      
      if (!reportResponse) {
        throw new Error('No data returned from rent collection report');
      }

      const result = {
        kpis: reportResponse.kpis || {},
        charts: reportResponse.charts || {},
        table: reportResponse.table || []
      };

      // Log details for debugging live data connection
      const hasData = Object.values(result.kpis).some(v => v > 0) || 
                      Object.values(result.charts).some(arr => arr.length > 0) || 
                      result.table.length > 0;
      
      if (!hasData) {
        console.warn('Rent collection report returned empty data for period:', { startDate, endDate });
        console.log('Checking if user has access to properties and payments...');
      } else {
        console.log('✅ Rent collection report successfully loaded with live data:', {
          kpiCount: Object.keys(result.kpis).length,
          totalCollected: result.kpis.total_collected || 0,
          tableRows: result.table.length
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to fetch rent collection report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  occupancy_report: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching occupancy report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_occupancy_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching occupancy report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch occupancy report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  maintenance_report: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching maintenance report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_maintenance_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching maintenance report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch maintenance report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  expense_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching expense summary report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_expense_summary_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching expense summary report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch expense summary report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  lease_expiry: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching lease expiry report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_lease_expiry_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching lease expiry report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch lease expiry report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  outstanding_balances: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching outstanding balances report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_outstanding_balances_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching outstanding balances report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch outstanding balances report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  property_performance: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching property performance report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_property_performance_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching property performance report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch property performance report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  profit_loss: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching profit loss report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_profit_loss_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching profit loss report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch profit loss report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  cash_flow: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching cash flow report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_cash_flow_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching cash flow report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch cash flow report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  revenue_vs_expenses: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching revenue vs expenses report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_revenue_vs_expenses_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching revenue vs expenses report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch revenue vs expenses report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  market_rent: async (filters: ReportFilters): Promise<ReportData> => {
    // Market rent analysis requires external data sources or manual input
    // Return empty structure for now
    return { 
      kpis: { 
        market_rent: 0, 
        current_rent: 0, 
        rent_variance: 0, 
        optimization_potential: 0 
      }, 
      charts: {}, 
      table: [] 
    };
  },

  tenant_turnover: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching tenant turnover report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_tenant_turnover_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching tenant turnover report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch tenant turnover report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  executive_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching executive summary report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_executive_summary_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching executive summary report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch executive summary report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  financial_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching financial summary report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_financial_summary_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching financial summary report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch financial summary report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },
};

// Helper function to calculate date ranges with support for all presets
function calculateDateRange(periodPreset: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let calculatedStartDate: string;
  let calculatedEndDate: string;

  if (startDate && endDate) {
    return { startDate, endDate };
  }

  switch (periodPreset) {
    case 'current_period':
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'last_12_months':
      calculatedStartDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'ytd':
      calculatedStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'last_6_months':
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'next_90_days':
      calculatedStartDate = now.toISOString().split('T')[0];
      calculatedEndDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'as_of_today':
      calculatedStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    default:
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  return { startDate: calculatedStartDate, endDate: calculatedEndDate };
}

export const getReportData = async (queryId: string, filters: ReportFilters): Promise<ReportData> => {
  console.time(`Report Query: ${queryId}`);
  console.log(`🔄 Fetching report data for ${queryId}`, { filters });
  
  const queryFunction = reportQueries[queryId as keyof typeof reportQueries];
  
  if (!queryFunction) {
    console.warn(`⚠️ No query function found for queryId: ${queryId}`);
    console.timeEnd(`Report Query: ${queryId}`);
    return { 
      kpis: {}, 
      charts: {}, 
      table: [] 
    };
  }

  try {
    const result = await queryFunction(filters);
    
    // Performance monitoring
    const hasData = Object.values(result.kpis).some(v => v > 0) || 
                   Object.values(result.charts).some(arr => Array.isArray(arr) && arr.length > 0) || 
                   result.table.length > 0;
    
    if (hasData) {
      console.log(`✅ Report ${queryId} loaded successfully:`, {
        kpiCount: Object.keys(result.kpis).length,
        chartCount: Object.keys(result.charts).length,
        tableRows: result.table.length
      });
    } else {
      console.log(`📊 Report ${queryId} returned empty data`);
    }
    
    // Ensure all KPI values default to 0 instead of undefined
    const defaultedKpis = Object.keys(result.kpis).reduce((acc, key) => {
      acc[key] = result.kpis[key] ?? 0;
      return acc;
    }, {} as Record<string, number>);

    // Limit table data for performance (first 1000 rows)
    const optimizedTable = result.table.length > 1000 
      ? result.table.slice(0, 1000)
      : result.table;

    if (result.table.length > 1000) {
      console.log(`⚡ Table data limited to 1000 rows for performance (was ${result.table.length})`);
    }

    console.timeEnd(`Report Query: ${queryId}`);
    
    return {
      kpis: defaultedKpis,
      charts: result.charts || {},
      table: optimizedTable
    };
  } catch (error) {
    console.error(`❌ Failed to fetch data for report ${queryId}:`, error);
    console.timeEnd(`Report Query: ${queryId}`);
    return { 
      kpis: {}, 
      charts: {}, 
      table: [] 
    };
  }
};
