import React from "react";
import { StatsCards } from "./StatsCards";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

export function GatedStatsCards() {
  return (
    <FeatureGate
      feature={FEATURES.BASIC_REPORTING}
      fallbackTitle="Analytics Dashboard"
      fallbackDescription="Get detailed insights into your property performance with advanced analytics."
      allowReadOnly={true}
      readOnlyMessage="Limited view - upgrade for full analytics"
    >
      <StatsCards />
    </FeatureGate>
  );
}