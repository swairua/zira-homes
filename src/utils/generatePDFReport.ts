import { getReportData } from '@/lib/reporting/queries';
import { getReportConfig } from '@/lib/reporting/config';
import { ReportFilters } from '@/lib/reporting/types';
import { UnifiedPDFRenderer } from '@/utils/unifiedPDFRenderer';
import { PDFTemplateService } from '@/utils/pdfTemplateService';
import { toast } from 'sonner';

export const generatePDFReport = async (
  reportId: string, 
  filters: ReportFilters,
  cachedReportData?: any // Accept cached data to avoid refetching
) => {
  try {
    console.log('Starting PDF generation for:', reportId, filters);
    console.time('Total PDF Generation');
    
    // Get report configuration
    const reportConfig = getReportConfig(reportId);
    if (!reportConfig) {
      throw new Error(`Report configuration not found for: ${reportId}`);
    }
    
    // Use cached data if provided, otherwise fetch fresh data
    let reportData;
    if (cachedReportData) {
      console.log('Using cached report data for PDF generation');
      reportData = cachedReportData;
    } else {
      console.log('Fetching fresh report data for PDF generation');
      reportData = await getReportData(reportConfig.queryId, filters);
    }
    
    console.log('Report data ready:', reportData);
    
    // Get PDF template and branding (cached internally)
    const { template, branding } = await PDFTemplateService.getTemplateAndBranding(
      'report' as any,
      'Landlord' as any
    );
    
    // Transform data to UnifiedPDFRenderer format
    const documentContent = {
      type: 'report' as const,
      title: reportConfig.title,
      content: {
        type: 'report',
        reportPeriod: filters.periodPreset?.replace(/_/g, ' ') || 'Current Period',
        summary: reportConfig.description,
        kpis: Object.entries(reportData.kpis).map(([key, value]) => {
          const kpiConfig = reportConfig.kpis.find(k => k.key === key);
          return {
            label: kpiConfig?.label || key,
            value: value,
            format: kpiConfig?.format || 'number',
            trend: undefined
          };
        }),
        tableData: reportData.table || [],
        charts: [], // No charts for uniform, reliable PDFs
        includeCharts: false, // Focus on KPIs and tables only
      },
    };
    
    // Generate PDF using UnifiedPDFRenderer (now with compression enabled)
    const pdfRenderer = new UnifiedPDFRenderer();
    await pdfRenderer.generateDocument(documentContent, branding);
    
    console.timeEnd('Total PDF Generation');
    toast.success('PDF report generated successfully');
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF report';
    toast.error(errorMessage);
    throw error;
  }
};
