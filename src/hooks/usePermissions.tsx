import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/context/RoleContext';

export interface SubUserPermissions {
  manage_properties: boolean;
  manage_tenants: boolean;
  manage_leases: boolean;
  manage_maintenance: boolean;
  manage_payments: boolean;
  view_reports: boolean;
  manage_expenses: boolean;
  send_messages: boolean;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const { isSubUser, subUserPermissions } = useRole();
  const [permissions, setPermissions] = useState<SubUserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      // If user is a sub-user
      if (isSubUser && subUserPermissions) {
        // Check if their landlord is on trial
        const { data: subUserData } = await supabase
          .from('sub_users')
          .select('landlord_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subUserData?.landlord_id) {
          const { data: landlordSubscription } = await supabase
            .from('landlord_subscriptions')
            .select('status, trial_end_date')
            .eq('landlord_id', subUserData.landlord_id)
            .eq('status', 'trial')
            .maybeSingle();

          if (landlordSubscription) {
            const trialEndDate = new Date(landlordSubscription.trial_end_date);
            const today = new Date();
            
            if (trialEndDate > today) {
              // GRANT FULL ACCESS DURING LANDLORD'S TRIAL
              setPermissions({
                manage_properties: true,
                manage_tenants: true,
                manage_leases: true,
                manage_maintenance: true,
                manage_payments: true,
                view_reports: true,
                manage_expenses: true,
                send_messages: true,
              });
              setLoading(false);
              return;
            }
          }
        }
        
        // Fall back to assigned permissions after trial
        setPermissions(subUserPermissions as any as SubUserPermissions);
        setLoading(false);
        return;
      }

      // For non-sub-users, grant all permissions
      setPermissions({
        manage_properties: true,
        manage_tenants: true,
        manage_leases: true,
        manage_maintenance: true,
        manage_payments: true,
        view_reports: true,
        manage_expenses: true,
        send_messages: true,
      });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [user, isSubUser, subUserPermissions]);

  const hasPermission = useCallback((permission: keyof SubUserPermissions | string) => {
    if (!permissions) return false;
    // For sub-user permissions
    if (permission in permissions) {
      return permissions[permission as keyof SubUserPermissions] === true;
    }
    // For admin/other permissions, always return true for non-sub-users
    return !isSubUser;
  }, [permissions, isSubUser]);

  const hasAnyPermission = useCallback((permissionList: (keyof SubUserPermissions | string)[]) => {
    return permissionList.some(permission => hasPermission(permission));
  }, [hasPermission]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    refetch: fetchUserPermissions
  };
};