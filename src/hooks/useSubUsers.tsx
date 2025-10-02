import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SubUser {
  id: string;
  landlord_id: string;
  user_id?: string;
  title?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}

export interface CreateSubUserData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
}

export const useSubUsers = () => {
  const { user, session } = useAuth();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubUsers = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch sub-users first
      const { data: subUsersData, error: subUsersError } = await supabase
        .from('sub_users')
        .select('*')
        .eq('landlord_id', user.id)
        .eq('status', 'active');

      if (subUsersError) throw subUsersError;

      // Then fetch profiles for those who have user_id
      const userIds = subUsersData?.filter(su => su.user_id).map(su => su.user_id) || [];
      let profilesData: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', userIds);

        if (profilesError) throw profilesError;
        profilesData = profiles || [];
      }

      // Transform and merge the data
      const transformedData: SubUser[] = (subUsersData || []).map(item => {
        const profile = profilesData.find(p => p.id === item.user_id);
        return {
          ...item,
          permissions: typeof item.permissions === 'string' 
            ? JSON.parse(item.permissions) 
            : item.permissions,
          profiles: profile ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
            phone: profile.phone
          } : undefined
        };
      });
      
      setSubUsers(transformedData);
    } catch (error) {
      console.error('Error fetching sub-users:', error);
      toast.error('Failed to load sub-users');
    } finally {
      setLoading(false);
    }
  };

  const createSubUser = async (data: CreateSubUserData) => {
    if (!user) return;

    try {
      // Use server proxy with service-role to create auth user + profile + sub_user
      let access: string | null = session?.access_token || null;
      if (!access) {
        try { const { data: s } = await supabase.auth.getSession(); access = s?.session?.access_token || null; } catch {}
      }

      const res = await fetch('/api/edge/create-sub-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({ ...data }),
      });

      const text = await res.text();
      let result: any; try { result = JSON.parse(text); } catch { result = { success: false, error: text || 'Unknown error' }; }

      if (!res.ok || !result?.success) {
        const detail = result?.error || result?.details || `${res.status} ${res.statusText}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      if (result.temporary_password) {
        toast.success(
          `Sub-user created successfully! Share these credentials: ${data.email} / ${result.temporary_password}`,
          { duration: 10000 }
        );
      } else {
        toast.success(`Sub-user added successfully for ${data.email}`, { duration: 6000 });
      }

      fetchSubUsers();
      return;
    } catch (primaryError) {
      console.warn('Proxy create-sub-user failed, falling back to Supabase invoke:', primaryError);
      try {
        const { data: result, error } = await supabase.functions.invoke('create-sub-user', {
          body: data,
          headers: (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined),
        });
        if (error || !result?.success) {
          const msg = error?.message || (result as any)?.error || 'Failed to create sub-user';
          throw new Error(msg);
        }
        toast.success('Sub-user created successfully');
        fetchSubUsers();
        return;
      } catch (error) {
        console.error('create-sub-user failed:', error);
        const message = error instanceof Error ? error.message : 'Failed to create sub-user';
        toast.error(message);
        throw error;
      }
    }
  };

  const updateSubUserPermissions = async (subUserId: string, permissions: SubUser['permissions']) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update({ permissions })
        .eq('id', subUserId);

      if (error) throw error;

      toast.success('Permissions updated successfully');
      fetchSubUsers();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const deactivateSubUser = async (subUserId: string) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update({ status: 'inactive' })
        .eq('id', subUserId);

      if (error) throw error;

      toast.success('Sub-user access revoked');
      fetchSubUsers();
    } catch (error) {
      console.error('Error deactivating sub-user:', error);
      toast.error('Failed to revoke access');
    }
  };

  useEffect(() => {
    fetchSubUsers();
  }, [user]);

  return {
    subUsers,
    loading,
    createSubUser,
    updateSubUserPermissions,
    deactivateSubUser,
    refetch: fetchSubUsers
  };
};
