import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface FeatureAccessResult {
  allowed: boolean;
  is_limited: boolean;
  limit?: number;
  remaining?: number;
  reason?: string;
  status?: string;
  plan_name?: string;
}

interface UsePlanFeatureAccessResult extends FeatureAccessResult {
  loading: boolean;
  checkAccess: (feature: string, currentCount?: number) => Promise<FeatureAccessResult>;
  refetch: () => void;
}

export function usePlanFeatureAccess(
  featureName?: string, 
  currentCount: number = 1
): UsePlanFeatureAccessResult {
  const { user } = useAuth();
  const [result, setResult] = useState<FeatureAccessResult>({
    allowed: false,
    is_limited: true,
    reason: 'loading'
  });
  const [loading, setLoading] = useState(true);

  const checkAccess = useCallback(async (
    feature: string, 
    count: number = 1
  ): Promise<FeatureAccessResult> => {
    if (!user) {
      return {
        allowed: false,
        is_limited: true,
        reason: 'not_authenticated'
      };
    }

    try {
      console.log(`🔍 Checking access for feature: ${feature}, count: ${count}`);
      
      const { data, error } = await supabase.rpc('check_plan_feature_access', {
        _user_id: user.id,
        _feature: feature,
        _current_count: count
      });

      if (error) {
        console.error('❌ Feature access check error:', error);
        throw error;
      }

      console.log('✅ Feature access result:', data);
      return (data as any) as FeatureAccessResult;
    } catch (error) {
      console.error('❌ Error checking feature access:', error);
      return {
        allowed: false,
        is_limited: true,
        reason: 'error'
      };
    }
  }, [user]);

  const refetch = useCallback(() => {
    if (featureName) {
      setLoading(true);
      checkAccess(featureName, currentCount).then(setResult).finally(() => setLoading(false));
    }
  }, [featureName, currentCount, checkAccess]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...result,
    loading,
    checkAccess,
    refetch
  };
}

// Predefined feature constants for type safety
export const FEATURES = {
  // Limits
  PROPERTIES_MAX: 'properties.max',
  UNITS_MAX: 'units.max',
  TENANTS_MAX: 'tenants.max',
  SMS_QUOTA: 'sms.quota',
  
  // Core Features
  BASIC_REPORTING: 'reports.basic',
  ADVANCED_REPORTING: 'reports.advanced',
  FINANCIAL_REPORTS: 'reports.financial',
  MAINTENANCE_TRACKING: 'maintenance.tracking',
  TENANT_PORTAL: 'tenant.portal',
  INVOICING: 'invoicing.basic',
  EXPENSE_TRACKING: 'expenses.tracking',
  
  // Integrations
  API_ACCESS: 'integrations.api',
  ACCOUNTING_INTEGRATION: 'integrations.accounting',
  SMS_NOTIFICATIONS: 'notifications.sms',
  EMAIL_NOTIFICATIONS: 'notifications.email',
  
  // Team & Permissions
  TEAM_ROLES: 'team.roles',
  SUB_USERS: 'team.sub_users',
  ROLE_PERMISSIONS: 'team.permissions',
  
  // Branding & Customization
  WHITE_LABEL: 'branding.white_label',
  CUSTOM_BRANDING: 'branding.custom',
  
  // Support
  PRIORITY_SUPPORT: 'support.priority',
  DEDICATED_SUPPORT: 'support.dedicated',
  
  // Advanced Features
  BULK_OPERATIONS: 'operations.bulk',
  AUTOMATED_BILLING: 'billing.automated',
  DOCUMENT_TEMPLATES: 'documents.templates',
  
  // Communication Features
  CUSTOM_EMAIL_TEMPLATES: 'communication.email_templates',
  CUSTOM_SMS_TEMPLATES: 'communication.sms_templates',
  NOTIFICATION_RESPONSES: 'communication.notification_responses',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];