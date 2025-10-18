import React from "react";
import { OptimizedChartsSection } from "./OptimizedChartsSection";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface GatedOptimizedChartsSectionProps {
  chartData: any[];
  isLoading: boolean;
}

export function GatedOptimizedChartsSection({ chartData, isLoading }: GatedOptimizedChartsSectionProps) {
  return (
    <FeatureGate
      feature={FEATURES.ADVANCED_REPORTING}
      fallbackTitle="Advanced Charts & Analytics"
      fallbackDescription="Visualize your property data with comprehensive charts and trend analysis."
      allowReadOnly={true}
      readOnlyMessage="Basic charts only - upgrade for advanced analytics"
    >
      <OptimizedChartsSection chartData={chartData} isLoading={isLoading} />
    </FeatureGate>
  );
}