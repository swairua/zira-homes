import React, { useState, useEffect } from "react";
import { X, Clock, CreditCard, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPath } from "@/utils/router";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export function FloatingTrialCountdown() {
  console.log('🚀 FloatingTrialCountdown component rendering...');
  const { user } = useAuth();
  const { trialStatus, trialDaysRemaining, loading } = useTrialManagement();
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check localStorage for dismissal status
    const dismissed = localStorage.getItem(`trial-dismissed-${user?.id}`);
    return dismissed === 'true';
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Debug logging
  console.log('🔍 FloatingTrialCountdown Debug:', {
    loading,
    user: user?.id,
    trialStatus,
    trialDaysRemaining,
    isDismissed
  });

  // Smart display logic - hide during onboarding and on billing pages
  const currentPath = getCurrentPath();
  const isOnBillingPage = currentPath.includes('/billing') || currentPath.includes('/upgrade');
  const isOnOnboardingPage = currentPath.includes('/onboarding');
  
  // Show for trial users with more robust conditions
  const shouldShow = !loading && 
    !isDismissed && 
    !isOnBillingPage &&
    !isOnOnboardingPage &&
    trialStatus && 
    (trialStatus.status === 'trial' || trialStatus.status === 'trial_expired') &&
    (trialStatus.planName === 'Free Trial' || !trialStatus.planName) && // Allow missing plan name
    trialDaysRemaining >= 0; // Show even on last day (0 days remaining)

  console.log('🎯 FloatingTrialCountdown shouldShow logic:', {
    shouldShow,
    conditions: {
      notLoading: !loading,
      notDismissed: !isDismissed,
      notOnBillingPage: !isOnBillingPage,
      notOnOnboardingPage: !isOnOnboardingPage,
      statusIsTrial: trialStatus?.status === 'trial',
      planIsFree: trialStatus?.planName === 'Free Trial',
      daysRemaining: trialDaysRemaining > 0
    }
  });

  if (!shouldShow) {
    console.log('❌ FloatingTrialCountdown not showing');
    return null;
  }

  // Calculate trial progress dynamically based on actual trial period
  const totalTrialDays = trialStatus?.totalTrialDays || 30;
  const trialProgress = ((totalTrialDays - trialDaysRemaining) / totalTrialDays) * 100;
  
  // Improved percentage-based urgency levels based on days remaining
  const urgencyLevel = trialDaysRemaining <= 3 ? 'critical' :    // Days 3-0: Red
                      trialDaysRemaining <= 10 ? 'warning' :     // Days 10-4: Orange
                      trialDaysRemaining <= 20 ? 'info' :        // Days 20-11: Blue
                      'early';                                   // Days 30-21: Green
  
  const getUrgencyStyles = () => {
    switch (urgencyLevel) {
      case 'critical':
        return 'bg-gradient-to-r from-destructive to-red-600 border-destructive/50 shadow-lg shadow-destructive/20';
      case 'warning':
        return 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-400/50 shadow-lg shadow-orange-500/20';
      case 'info':
        return 'bg-gradient-to-r from-primary to-blue-600 border-primary/50 shadow-lg shadow-primary/20';
      case 'early':
      default:
        return 'bg-gradient-to-r from-green-500 to-green-600 border-green-400/50 shadow-lg shadow-green-500/20';
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage for 24 hours
    if (user?.id) {
      localStorage.setItem(`trial-dismissed-${user.id}`, 'true');
      // Set a timeout to remove the dismissal after 24 hours
      setTimeout(() => {
        localStorage.removeItem(`trial-dismissed-${user.id}`);
      }, 24 * 60 * 60 * 1000);
    }
  };

  // Return null since trial countdown is now shown in the header
  return null;
}
