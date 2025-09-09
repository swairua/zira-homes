import React, { useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
export function HeaderTrialCountdown() {
  const {
    user
  } = useAuth();
  const {
    trialStatus,
    trialDaysRemaining,
    loading
  } = useTrialManagement();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Show only for trial users in header
  const shouldShow = !loading && trialStatus && (trialStatus.status === 'trial' || trialStatus.status === 'trial_expired') && trialDaysRemaining >= 0;
  if (!shouldShow) {
    return null;
  }
  const isUrgent = trialDaysRemaining <= 3;
  const urgencyLevel = trialDaysRemaining <= 3 ? 'critical' : trialDaysRemaining <= 7 ? 'warning' : 'info';
  const getUrgencyColor = () => {
    switch (urgencyLevel) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };
  return <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowUpgradeModal(true)}
          className="focus:outline-none"
          aria-label="Upgrade plan"
          title="Upgrade plan"
        >
          <Badge 
            variant={trialDaysRemaining <= 3 ? 'destructive' : trialDaysRemaining <= 7 ? 'secondary' : 'default'}
            className={`px-2 py-0.5 text-[10px] sm:text-xs shadow-md ${isUrgent ? 'animate-pulse' : ''}`}
          >
            <Clock className="h-3 w-3 mr-1" />
            <span className="sm:hidden">{trialDaysRemaining === 1 ? '1d' : `${trialDaysRemaining}d`}</span>
            <span className="hidden sm:inline">{trialDaysRemaining === 1 ? 'Last Day' : `${trialDaysRemaining} Days`}</span>
          </Badge>
        </button>
      </div>
      
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>;
}