import React from "react";
import { ChartsSection } from "./ChartsSection";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

export function GatedChartsSection() {
  return (
    <FeatureGate
      feature={FEATURES.ADVANCED_REPORTING}
      fallbackTitle="Advanced Charts & Analytics"
      fallbackDescription="Visualize your property data with comprehensive charts and trend analysis."
      allowReadOnly={true}
      readOnlyMessage="Basic charts only - upgrade for advanced analytics"
    >
      <ChartsSection />
    </FeatureGate>
  );
}