import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePDFGeneration } from './usePDFGeneration';
import { useReportPrefetch } from './useReportPrefetch';
import { getReportData } from '@/lib/reporting/queries';
import { ReportFilters } from '@/lib/reporting/types';
import { toast } from 'sonner';

interface OptimizedGenerationState {
  isPrefetching: boolean;
  isGenerating: boolean;
  progress: number;
  currentStep: string;
}

export const useOptimizedReportGeneration = () => {
  const queryClient = useQueryClient();
  const { generatePDF } = usePDFGeneration();
  const { prefetchReportData } = useReportPrefetch();
  
  const [state, setState] = useState<OptimizedGenerationState>({
    isPrefetching: false,
    isGenerating: false,
    progress: 0,
    currentStep: ''
  });

  const generateOptimizedReport = useCallback(async (
    reportId: string,
    reportTitle: string,
    filters: ReportFilters
  ) => {
    try {
      console.time(`Optimized Report Generation: ${reportTitle}`);
      
      setState(prev => ({ 
        ...prev, 
        isPrefetching: true, 
        currentStep: 'Prefetching report data...' 
      }));

      // Step 1: Prefetch data if not already cached
      await prefetchReportData(reportId, filters, reportTitle);
      
      setState(prev => ({ 
        ...prev, 
        isPrefetching: false, 
        isGenerating: true,
        currentStep: 'Starting PDF generation...'
      }));

      // Step 2: Generate PDF using cached data
      await generatePDF(reportTitle, reportId, reportId, filters, false); // No charts for speed

      console.timeEnd(`Optimized Report Generation: ${reportTitle}`);
      
      setState({
        isPrefetching: false,
        isGenerating: false,
        progress: 0,
        currentStep: ''
      });

    } catch (error) {
      console.error('Optimized report generation failed:', error);
      toast.error('Failed to generate report');
      
      setState({
        isPrefetching: false,
        isGenerating: false,
        progress: 0,
        currentStep: ''
      });
    }
  }, [generatePDF, prefetchReportData]);

  const preloadReport = useCallback(async (
    reportId: string, 
    filters: ReportFilters,
    reportTitle?: string
  ) => {
    // Background prefetch without blocking UI
    prefetchReportData(reportId, filters, reportTitle);
  }, [prefetchReportData]);

  return {
    ...state,
    generateOptimizedReport,
    preloadReport,
    isActive: state.isPrefetching || state.isGenerating
  };
};