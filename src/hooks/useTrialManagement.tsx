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
    console.log('🔄 useTrialManagement: Starting checkTrialStatus for user:', user?.id);
    
    if (!user) {
      console.log('❌ useTrialManagement: No user found');
      setLoading(false);
      return;
    }

    try {
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
      const { data: statusResult, error: statusError } = await supabase
        .rpc('get_trial_status', { _user_id: user.id });

      if (statusError) {
        try {
          console.error('useTrialManagement: get_trial_status RPC error:', JSON.stringify(statusError, Object.getOwnPropertyNames(statusError), 2));
        } catch (e) {
          console.error('useTrialManagement: get_trial_status RPC error (non-serializable):', statusError);
        }
      }

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

      if (subscriptionError) {
        try {
          console.error('useTrialManagement: landlord_subscriptions query error:', JSON.stringify(subscriptionError, Object.getOwnPropertyNames(subscriptionError), 2));
        } catch (e) {
          console.error('useTrialManagement: landlord_subscriptions query error (non-serializable):', subscriptionError);
        }
      }

      console.log('💳 useTrialManagement: Subscription data:', subscription);

      // Fallback: If subscription query fails but we have RPC status, create synthetic trial status
      if (!subscription && statusResult) {
        console.log('🔄 useTrialManagement: No subscription found, using RPC fallback...');
        
        // Try to get basic subscription data without billing plan join
        const { data: basicSubscription, error: basicSubError } = await supabase
          .from('landlord_subscriptions')
          .select('*')
          .eq('landlord_id', user.id)
          .maybeSingle();

        if (basicSubError) {
          try {
            console.error('useTrialManagement: basic subscription query error:', JSON.stringify(basicSubError, Object.getOwnPropertyNames(basicSubError), 2));
          } catch (e) {
            console.error('useTrialManagement: basic subscription query error (non-serializable):', basicSubError);
          }
        }

        console.log('🔧 useTrialManagement: Basic subscription fallback:', basicSubscription);

        if (basicSubscription || statusResult === 'trial') {
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
            totalTrialDays: totalTrialDays,
            planName: 'Free Trial', // Default fallback
            planId: undefined
          };

          console.log('🎯 useTrialManagement: Setting fallback trial status:', fallbackTrialStatus);
          setTrialStatus(fallbackTrialStatus);

          if (basicSubscription && !basicSubscription.onboarding_completed) {
            setShowOnboarding(true);
          }
        }
      } else if (subscription) {
        console.log('✅ useTrialManagement: Processing subscription data...');
        const actualStatus = statusResult || subscription.status;
        const isTrialRelated = ['trial', 'trial_expired', 'suspended'].includes(actualStatus);
        
        console.log('🏷️ useTrialManagement: Processed status info:', {
          actualStatus,
          isTrialRelated,
          planName: subscription.billing_plan?.name
        });
        
        setIsTrialUser(isTrialRelated);
        
        let daysRemaining = 0;
        let gracePeriodDays = 0;
        
        if (subscription.trial_end_date) {
          const trialEndDate = new Date(subscription.trial_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Reset to midnight for accurate day calculation
          trialEndDate.setHours(23, 59, 59, 999); // Set to end of day
          
          daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          console.log('📅 useTrialManagement: Date calculations:', {
            trialEndDate: trialEndDate.toISOString(),
            today: today.toISOString(),
            daysRemaining,
            rawCalculation: (trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          });
          
          // Calculate grace period days remaining if in grace period
          if (actualStatus === 'trial_expired') {
            const gracePeriodEnd = new Date(trialEndDate.getTime() + (7 * 24 * 60 * 60 * 1000));
            gracePeriodDays = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
        
        setTrialDaysRemaining(Math.max(0, daysRemaining));
        
        // Calculate total trial days from subscription data
        const totalTrialDays = subscription.trial_start_date && subscription.trial_end_date
          ? Math.ceil((new Date(subscription.trial_end_date).getTime() - new Date(subscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24))
          : 30; // Default fallback

        const finalTrialStatus = {
          status: actualStatus,
          isActive: actualStatus === 'trial' && daysRemaining > 0,
          isExpired: actualStatus === 'trial_expired',
          isSuspended: actualStatus === 'suspended',
          hasGracePeriod: actualStatus === 'trial_expired' && gracePeriodDays > 0,
          daysRemaining: Math.max(0, daysRemaining),
          gracePeriodDays: gracePeriodDays,
          totalTrialDays: totalTrialDays,
          planName: subscription.billing_plan?.name || 'Free Trial',
          planId: subscription.billing_plan?.id
        };

        console.log('🎯 useTrialManagement: Setting final trial status:', finalTrialStatus);
        setTrialStatus(finalTrialStatus);

        // Show onboarding if not completed
        if (!subscription.onboarding_completed) {
          setShowOnboarding(true);
        }
      } else {
        console.log('❌ useTrialManagement: No subscription found and no RPC status');
      }
    } catch (error) {
      try {
        console.error('❌ useTrialManagement: Error checking trial status:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('❌ useTrialManagement: Error checking trial status (non-serializable):', error);
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
      try {
        console.error('Error tracking feature usage:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('Error tracking feature usage (non-serializable):', error);
      }
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
      try {
        console.error('Error checking feature access:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('Error checking feature access (non-serializable):', error);
      }
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
