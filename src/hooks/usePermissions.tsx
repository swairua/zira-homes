import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Permission {
  permission_name: string;
  category: string;
  description: string;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_user_permissions', { _user_id: user.id });

      if (error) throw error;
      
      // Map the RPC response to match the Permission interface
      const mappedPermissions: Permission[] = (data || []).map(item => ({
        permission_name: item.permission_name,
        category: 'general', // Default category since RPC doesn't return this
        description: item.permission_name // Use permission name as description
      }));
      
      setPermissions(mappedPermissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const hasPermission = useCallback((permission: string) => {
    return permissions.some(p => p.permission_name === permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionList: string[]) => {
    return permissionList.some(permission => hasPermission(permission));
  }, [hasPermission]);

  const getPermissionsByCategory = useCallback((category: string) => {
    return permissions.filter(p => p.category === category);
  }, [permissions]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    getPermissionsByCategory,
    refetch: fetchUserPermissions
  };
};