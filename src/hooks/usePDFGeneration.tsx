
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedPDFRenderer } from '@/utils/unifiedPDFRenderer';
import { PDFTemplateService } from '@/utils/pdfTemplateService';
import { buildUnifiedReportContent } from '@/utils/reportContentBuilder';
import { getReportData } from '@/lib/reporting/queries';
import { toast } from 'sonner';

interface PDFGenerationState {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  isComplete: boolean;
}

export const usePDFGeneration = () => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PDFGenerationState>({
    isGenerating: false,
    progress: 0,
    currentStep: '',
    isComplete: false
  });

  const updateProgress = useCallback((progress: number, step: string) => {
    setState(prev => ({
      ...prev,
      progress,
      currentStep: step
    }));
  }, []);

  const generatePDF = useCallback(async (
    reportTitle: string,
    reportId: string,
    queryId: string,
    filters: any,
    includeCharts: boolean = false // Disable charts for uniform, reliable PDFs
  ) => {
    try {
      setState({
        isGenerating: true,
        progress: 0,
        currentStep: 'Initializing PDF generation...',
        isComplete: false
      });

      // Step 1: Try to use cached report data first for instant PDF generation
      updateProgress(20, 'Loading report data...');
      console.time('PDF Report Data Fetch');
      
      // Try to get cached data first
      const cachedData = queryClient.getQueryData(['report-data', queryId, filters]);
      let reportData;
      
      if (cachedData) {
        console.log('Using cached report data for PDF generation');
        reportData = cachedData;
      } else {
        console.log('Fetching fresh report data for PDF generation');
        reportData = await getReportData(queryId, filters);
        // Cache the data for next time
        queryClient.setQueryData(['report-data', queryId, filters], reportData);
      }
      
      console.timeEnd('PDF Report Data Fetch');
      
      console.log('Fetched report data:', reportData);

      // Step 2: Fetch template and branding
      updateProgress(40, 'Loading PDF template and branding...');
      const { template, branding } = await PDFTemplateService.getTemplateAndBranding(
        'report' as any,
        'Landlord'
      );

      // Step 3: Build report content
      updateProgress(60, 'Building report content...');
      const period = filters.periodPreset?.replace(/_/g, ' ') || 'Current Period';
      const reportContent = buildUnifiedReportContent({
        reportType: reportId, // Use kebab-case reportId for content building
        period,
        sourceData: reportData,
        summaryOverride: null,
      });

      // Step 4: Initialize PDF renderer
      updateProgress(80, 'Initializing PDF renderer...');
      const pdfRenderer = new UnifiedPDFRenderer();

      // Step 5: Generate PDF
      updateProgress(90, 'Rendering PDF document...');
      const document = {
        type: 'report' as const,
        title: reportTitle,
        content: {
          type: reportId,
          reportPeriod: reportContent.period,
          summary: reportContent.summary,
          kpis: reportContent.kpis,
          tableData: reportContent.tableData,
          charts: [], // No charts for uniform, reliable PDFs
          includeCharts: false, // Focus on KPIs and tables only
        },
      };

      await pdfRenderer.generateDocument(document, branding);

      // Step 6: Download PDF
      updateProgress(100, 'Downloading PDF...');
      // The PDF is auto-downloaded by the renderer

      setState(prev => ({
        ...prev,
        isComplete: true,
        currentStep: 'PDF generated successfully!'
      }));

      toast.success('PDF report generated successfully');
      
      // Reset state after 2 seconds
      setTimeout(() => {
        setState({
          isGenerating: false,
          progress: 0,
          currentStep: '',
          isComplete: false
        });
      }, 2000);

    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF report');
      setState({
        isGenerating: false,
        progress: 0,
        currentStep: '',
        isComplete: false
      });
    }
  }, [updateProgress]);

  return {
    ...state,
    generatePDF
  };
};
