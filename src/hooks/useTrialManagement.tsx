import { useState, useEffect } from "react";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { restSelect, rpcProxy, restUpsert, restUpdate } from '@/integrations/supabase/restProxy';

interface TrialStatus {
  status: string;
  isActive: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  hasGracePeriod: boolean;
  daysRemaining: number;
  gracePeriodDays?: number;
  totalTrialDays?: number;
  planName?: string;
  planId?: string;
}

export function useTrialManagement() {
  const { user } = useAuth();
  const [isTrialUser, setIsTrialUser] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkTrialStatus();
    }
  }, [user]);

  const checkTrialStatus = useCallback(async () => {
    console.log('🔄 useTrialManagement: Starting checkTrialStatus for user:', user?.id);
    if (!user) {
      console.log('❌ useTrialManagement: No user found');
      setLoading(false);
      return;
    }

    try {
      // Fetch user roles
      const rolesRes = await restSelect('user_roles', 'role', { user_id: `eq.${user.id}` });
      if (rolesRes.error) {
        console.warn('useTrialManagement: failed to fetch user roles', rolesRes.error);
      }
      let rolesData: any = rolesRes.data;
      if (!Array.isArray(rolesData)) {
        if (rolesData && typeof rolesData === 'object' && Array.isArray((rolesData as any).data)) rolesData = (rolesData as any).data;
        else if (rolesData == null || rolesData === '') rolesData = [];
        else rolesData = [rolesData];
      }

      const currentUserRole = rolesData?.[0]?.role;
      setUserRole(currentUserRole);

      // Only check trial status for property-related roles
      if (!currentUserRole || !['Landlord', 'Manager', 'Agent'].includes(currentUserRole)) {
        setLoading(false);
        return;
      }

      // Call RPC for trial status
      const statusRes = await rpcProxy('get_trial_status', { _user_id: user.id });
      const statusResult = statusRes.data;
      if (statusRes.error) console.warn('useTrialManagement: get_trial_status error', statusRes.error);

      // Try to fetch subscription with join to billing_plan
      const subRes = await restSelect('landlord_subscriptions', '*,billing_plan:billing_plans(*)', { landlord_id: `eq.${user.id}` }, true);
      if (subRes.error) console.warn('useTrialManagement: subscription query error', subRes.error);
      const subscription = subRes.data || null;

      // Fallback: basic subscription
      let basicSubscription: any = null;
      if (!subscription && statusResult) {
        const basicRes = await restSelect('landlord_subscriptions', '*', { landlord_id: `eq.${user.id}` }, true);
        if (basicRes.error) console.warn('useTrialManagement: basic subscription error', basicRes.error);
        basicSubscription = basicRes.data || null;
      }

      // Determine trial status
      if (!subscription && statusResult) {
        const isTrialRelated = ['trial', 'trial_expired', 'suspended'].includes(statusResult);
        setIsTrialUser(isTrialRelated);

        let daysRemaining = 0;
        let totalTrialDays = 30;

        if (basicSubscription?.trial_end_date) {
          const trialEndDate = new Date(basicSubscription.trial_end_date);
          const today = new Date();
          daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (basicSubscription.trial_start_date) {
            totalTrialDays = Math.ceil((trialEndDate.getTime() - new Date(basicSubscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        setTrialDaysRemaining(Math.max(0, daysRemaining));

        const fallbackTrialStatus = {
          status: statusResult,
          isActive: statusResult === 'trial' && daysRemaining > 0,
          isExpired: statusResult === 'trial_expired',
          isSuspended: statusResult === 'suspended',
          hasGracePeriod: statusResult === 'trial_expired',
          daysRemaining: Math.max(0, daysRemaining),
          gracePeriodDays: 0,
          totalTrialDays,
          planName: 'Free Trial',
          planId: undefined
        };

        setTrialStatus(fallbackTrialStatus);

        if (basicSubscription && !basicSubscription.onboarding_completed) {
          setShowOnboarding(true);
        }
      } else if (subscription) {
        const actualStatus = statusResult || subscription.status;
        const isTrialRelated = ['trial', 'trial_expired', 'suspended'].includes(actualStatus);
        setIsTrialUser(isTrialRelated);

        let daysRemaining = 0;
        let gracePeriodDays = 0;

        if (subscription.trial_end_date) {
          const trialEndDate = new Date(subscription.trial_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          trialEndDate.setHours(23, 59, 59, 999);
          daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (actualStatus === 'trial_expired') {
            const gracePeriodEnd = new Date(trialEndDate.getTime() + (7 * 24 * 60 * 60 * 1000));
            gracePeriodDays = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        setTrialDaysRemaining(Math.max(0, daysRemaining));

        const totalTrialDays = subscription.trial_start_date && subscription.trial_end_date
          ? Math.ceil((new Date(subscription.trial_end_date).getTime() - new Date(subscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24))
          : 30;

        const finalTrialStatus = {
          status: actualStatus,
          isActive: actualStatus === 'trial' && daysRemaining > 0,
          isExpired: actualStatus === 'trial_expired',
          isSuspended: actualStatus === 'suspended',
          hasGracePeriod: actualStatus === 'trial_expired' && gracePeriodDays > 0,
          daysRemaining: Math.max(0, daysRemaining),
          gracePeriodDays,
          totalTrialDays,
          planName: subscription.billing_plan?.name || 'Free Trial',
          planId: subscription.billing_plan?.id
        };

        setTrialStatus(finalTrialStatus);

        if (!subscription.onboarding_completed) setShowOnboarding(true);
      }
    } catch (error) {
      try { console.error('❌ useTrialManagement: Error checking trial status:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2)); } catch(e) { console.error(error); }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const trackFeatureUsage = useCallback(async (featureName: string) => {
    if (!user || !isTrialUser) return;

    try {
      await restUpsert('trial_usage_tracking', {
        user_id: user.id,
        feature_name: featureName,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      });

      const currentUsageData: any = (trialStatus as any)?.daysRemaining || {};
      await restUpdate('landlord_subscriptions', { trial_usage_data: { ...currentUsageData, [featureName]: ((currentUsageData as any)?.[featureName] || 0) + 1 } }, { landlord_id: `eq.${user.id}` });
    } catch (error) {
      try { console.error('Error tracking feature usage:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2)); } catch(e) { console.error(error); }
    }
  }, [user, isTrialUser, trialStatus]);

  const checkFeatureAccess = useCallback(async (featureName: string, currentCount: number = 1): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await rpcProxy('check_trial_limitation', { _user_id: user.id, _feature: featureName, _current_count: currentCount });
      if (res.error) {
        console.warn('useTrialManagement: check_trial_limitation error', res.error);
        return false;
      }
      return Boolean(res.data);
    } catch (error) {
      try { console.error('Error checking feature access:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2)); } catch(e) { console.error(error); }
      return false;
    }
  }, [user]);

  return {
    isTrialUser,
    showOnboarding,
    trialDaysRemaining,
    trialStatus,
    loading,
    userRole,
    setShowOnboarding,
    trackFeatureUsage,
    checkFeatureAccess,
    refreshTrialStatus: checkTrialStatus,
  };
}
