import React from "react";
import { OptimizedStatsCards } from "./OptimizedStatsCards";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface GatedOptimizedStatsCardsProps {
  stats: any;
  isLoading: boolean;
}

export function GatedOptimizedStatsCards({ stats, isLoading }: GatedOptimizedStatsCardsProps) {
  return (
    <FeatureGate
      feature={FEATURES.BASIC_REPORTING}
      fallbackTitle="Analytics Dashboard"
      fallbackDescription="Get detailed insights into your property performance with advanced analytics."
      allowReadOnly={true}
      readOnlyMessage="Limited view - upgrade for full analytics"
    >
      <OptimizedStatsCards stats={stats} isLoading={isLoading} />
    </FeatureGate>
  );
}