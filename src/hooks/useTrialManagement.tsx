import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  const checkTrialStatus = async () => {
    const timestamp = new Date().toISOString();
    console.log(`🔄 [${timestamp}] useTrialManagement: Starting checkTrialStatus for user:`, user?.id);
    
    if (!user) {
      console.log('❌ useTrialManagement: No user found');
      setLoading(false);
      return;
    }

    try {
      // Try to load cached trial status for immediate display
      const cachedStatus = localStorage.getItem(`trial-status-${user.id}`);
      if (cachedStatus) {
        try {
          const parsed = JSON.parse(cachedStatus);
          console.log('📦 useTrialManagement: Loaded cached status:', parsed);
          setTrialStatus(parsed.trialStatus);
          setTrialDaysRemaining(parsed.trialDaysRemaining);
          setIsTrialUser(parsed.isTrialUser);
        } catch (e) {
          console.error('❌ Failed to parse cached trial status:', e);
        }
      }
      console.log('🔍 useTrialManagement: Checking user role...');
      // Check user role first
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      console.log('📝 useTrialManagement: User roles fetched:', userRoles);
      
      const currentUserRole = userRoles?.[0]?.role;
      setUserRole(currentUserRole);
      
      console.log('👤 useTrialManagement: Current user role:', currentUserRole);
      
      // Only check trial status for property-related roles
      if (!currentUserRole || !['Landlord', 'Manager', 'Agent'].includes(currentUserRole)) {
        console.log('❌ useTrialManagement: User role not property-related, exiting');
        setLoading(false);
        return;
      }

      console.log('🎯 useTrialManagement: Getting trial status via RPC...');
      // Get actual trial status using the database function
      const { data: statusResult } = await supabase
        .rpc('get_trial_status', { _user_id: user.id });

      console.log('📊 useTrialManagement: RPC status result:', statusResult);

      // Try to fetch subscription with robust error handling
      console.log('🔍 useTrialManagement: Fetching subscription data with maybeSingle...');
      const { data: subscription, error: subscriptionError } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plan:billing_plans(*)
        `)
        .eq('landlord_id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle zero results

      console.log('💳 useTrialManagement: Subscription data:', subscription);
      console.log('❗ useTrialManagement: Subscription error:', subscriptionError);

      // Fallback: Always try to fetch basic subscription data
      let basicSubscription = null;
      if (!subscription) {
        console.log('🔄 useTrialManagement: No joined subscription, fetching basic data...');
        const { data: basic } = await supabase
          .from('landlord_subscriptions')
          .select('*')
          .eq('landlord_id', user.id)
          .maybeSingle();
        basicSubscription = basic;
        console.log('🔧 useTrialManagement: Basic subscription fallback:', basicSubscription);
      }

      // Use subscription or fallback to basic subscription
      const effectiveSubscription = subscription || basicSubscription;

      if (!effectiveSubscription) {
        console.log('❌ useTrialManagement: No subscription found at all');
      } else {
        console.log('✅ useTrialManagement: Processing subscription data...');
        const actualStatus = statusResult || effectiveSubscription.status;
        const isTrialRelated = ['trial', 'trial_expired', 'suspended'].includes(actualStatus);
        
        console.log('🏷️ useTrialManagement: Processed status info:', {
          actualStatus,
          isTrialRelated,
          hasRpcStatus: !!statusResult,
          subscriptionStatus: effectiveSubscription.status
        });
        
        setIsTrialUser(isTrialRelated);
        
        let daysRemaining = 0;
        let gracePeriodDays = 0;
        let totalTrialDays = 30;
        
        if (effectiveSubscription.trial_end_date) {
          const trialEndDate = new Date(effectiveSubscription.trial_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          trialEndDate.setHours(23, 59, 59, 999);
          
          daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          console.log('📅 useTrialManagement: Date calculations:', {
            trialEndDate: trialEndDate.toISOString(),
            today: today.toISOString(),
            daysRemaining
          });
          
          // Calculate grace period
          if (actualStatus === 'trial_expired') {
            const gracePeriodEnd = new Date(trialEndDate.getTime() + (7 * 24 * 60 * 60 * 1000));
            gracePeriodDays = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          }

          // Calculate total trial days
          if (effectiveSubscription.trial_start_date) {
            totalTrialDays = Math.ceil((trialEndDate.getTime() - new Date(effectiveSubscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24));
          }
        }
        
        setTrialDaysRemaining(Math.max(0, daysRemaining));

        const finalTrialStatus = {
          status: actualStatus,
          isActive: actualStatus === 'trial' && daysRemaining > 0,
          isExpired: actualStatus === 'trial_expired',
          isSuspended: actualStatus === 'suspended',
          hasGracePeriod: actualStatus === 'trial_expired' && gracePeriodDays > 0,
          daysRemaining: Math.max(0, daysRemaining),
          gracePeriodDays: gracePeriodDays,
          totalTrialDays: totalTrialDays,
          planName: (subscription?.billing_plan as any)?.name || 'Free Trial',
          planId: (subscription?.billing_plan as any)?.id
        };

        console.log('🎯 useTrialManagement: Setting final trial status:', finalTrialStatus);
        setTrialStatus(finalTrialStatus);

        // Cache the trial status
        try {
          localStorage.setItem(`trial-status-${user.id}`, JSON.stringify({
            trialStatus: finalTrialStatus,
            trialDaysRemaining: Math.max(0, daysRemaining),
            isTrialUser: isTrialRelated,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          console.error('❌ Failed to cache trial status:', e);
        }

        // Show onboarding if not completed
        if (!effectiveSubscription.onboarding_completed) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      try {
        console.error('❌ useTrialManagement: Error checking trial status:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        console.error('❌ useTrialManagement: Error checking trial status (unserializable):', error);
      }
    } finally {
      console.log('🏁 useTrialManagement: Finished, setting loading to false');
      setLoading(false);
    }
  };

  const trackFeatureUsage = async (featureName: string) => {
    if (!user || !isTrialUser) return;

    try {
      // Update usage count in trial_usage_tracking table
      await supabase
        .from('trial_usage_tracking')
        .upsert({
          user_id: user.id,
          feature_name: featureName,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
        });

      // Update usage data in subscription
      const currentUsageData = trialStatus?.daysRemaining || {};
      await supabase
        .from('landlord_subscriptions')
        .update({
          trial_usage_data: {
            ...currentUsageData,
            [featureName]: ((currentUsageData as any)?.[featureName] || 0) + 1
          }
        })
        .eq('landlord_id', user.id);
    } catch (error) {
      console.error('Error tracking feature usage:', error);
    }
  };

  const checkFeatureAccess = async (featureName: string, currentCount: number = 1): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data: canAccess } = await supabase
        .rpc('check_trial_limitation', {
          _user_id: user.id,
          _feature: featureName,
          _current_count: currentCount
        });
      
      return canAccess || false;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  };

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
