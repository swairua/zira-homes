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
      console.log('Creating sub-user with edge function:', data);
      
      const headers: Record<string,string> = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const { data: result, error } = await supabase.functions.invoke('create-sub-user', {
        body: JSON.stringify(data),
        headers
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to create sub-user');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create sub-user');
      }

      console.log('Sub-user created successfully:', result);
      
      // Show appropriate message based on whether temporary password was provided
      if (result.temporary_password) {
        toast.success(
          `Sub-user created successfully! Share these credentials with them: Email: ${data.email}, Temporary password: ${result.temporary_password}`,
          { duration: 10000 }
        );
      } else {
        toast.success(
          `Sub-user added successfully! They can log in using their existing credentials at ${data.email}`,
          { duration: 6000 }
        );
      }
      
      fetchSubUsers();
    } catch (error) {
      console.error('Error creating sub-user:', error);
      // Attempt explicit fallback via server proxy to gather more details
      try {
        const headers: Record<string,string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch('/api/edge/create-sub-user', { method: 'POST', headers, body: JSON.stringify(data) });
        const text = await res.text();
        let bodyResp: any = null;
        try { bodyResp = JSON.parse(text); } catch { bodyResp = text; }
        console.error('Fallback proxy response for create-sub-user:', res.status, bodyResp);
        toast.error(`Edge function failed: ${res.status} ${res.statusText}`);
      } catch (fallbackErr) {
        console.error('Fallback proxy call failed:', fallbackErr);
        toast.error('Edge function failed and proxy fallback unavailable');
      }

      const message = error instanceof Error ? error.message : 'Failed to create sub-user';
      toast.error(message);
      throw error;
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
