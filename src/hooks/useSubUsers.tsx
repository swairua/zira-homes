import { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
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

    let access: string | null = session?.access_token || null;
    if (!access) {
      try { const { data: s } = await supabase.auth.getSession(); access = s?.session?.access_token || null; } catch {}
    }

    const diagnostics: any[] = [];

    try {
      // 1) Server proxy (service-role) — richest error details
      try {
        const res = await fetch('/api/edge/create-sub-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
            ...(user?.id ? { 'x-landlord-id': user.id } : {}),
          },
          body: JSON.stringify({ ...data, ...(user?.id ? { landlord_id: user.id } : {}) })
        });
        const text = await res.text().catch(() => '');
        let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }

        if (!res.ok || !parsed?.success) {
          diagnostics.push({ source: 'server-proxy', status: res.status, statusText: res.statusText, body: parsed ?? text });
          throw new Error('server-proxy failed');
        }

        if (parsed.temporary_password) {
          toast.success(`Sub-user created successfully! Share these credentials: ${data.email} / ${parsed.temporary_password}`, { duration: 10000 });
        } else {
          toast.success(`Sub-user added successfully for ${data.email}`, { duration: 6000 });
        }
        fetchSubUsers();
        return;
      } catch (e) {}

      // 2) Supabase functions.invoke with explicit auth header
      let invokeResp: any = null;
      try {
        invokeResp = await (supabase.functions as any).invoke('create-sub-user', {
          body: { ...data },
          headers: { ...(access ? { Authorization: `Bearer ${access}` } : {}) }
        });
      } catch (fnErr: any) {
        let details = fnErr?.message || 'Edge function invocation failed';
        try {
          if (fnErr?.response && typeof fnErr.response.text === 'function') {
            const txt = await fnErr.response.text();
            try { const j = JSON.parse(txt); details = j.error || j.message || j.details || JSON.stringify(j); } catch { details = txt; }
          }
        } catch {}
        diagnostics.push({ source: 'invoke-throw', name: fnErr?.name || null, status: fnErr?.status || null, details });
        throw new Error('invoke-throw');
      }

      const iErr = invokeResp?.error || null;
      const iData = invokeResp?.data ?? invokeResp;
      if (iErr || !iData?.success) {
        diagnostics.push({
          source: 'invoke-result',
          name: iErr?.name || null,
          status: iErr?.status || iErr?.context?.response?.status || iData?.status || null,
          message: iErr?.message || iData?.error || iData?.message || null,
          details: iErr?.details || iErr?.context || iData?.details || null,
          raw: iData || null,
        });

        // 3) Direct function URL fetch to capture raw body
        try {
          const fnUrl = `${(SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/create-sub-user`;
          const r = await fetch(fnUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_PUBLISHABLE_KEY,
              ...(access ? { 'Authorization': `Bearer ${access}` } : {}),
            },
            body: JSON.stringify({ ...data })
          });
          const txt = await r.text().catch(() => '');
          let j: any; try { j = JSON.parse(txt); } catch { j = null; }
          diagnostics.push({ source: 'direct-function', status: r.status, statusText: r.statusText, body: j ?? txt });
        } catch (dfErr: any) {
          diagnostics.push({ source: 'direct-function-error', message: dfErr?.message || String(dfErr) });
        }

        throw new Error('invoke-result failed');
      }

      if (iData.temporary_password) {
        toast.success(`Sub-user created successfully! Share these credentials: ${data.email} / ${iData.temporary_password}`, { duration: 10000 });
      } else {
        toast.success(`Sub-user added successfully for ${data.email}`, { duration: 6000 });
      }
      fetchSubUsers();
      return;
    } catch (primaryError: any) {
      console.error('create-sub-user failed:', primaryError, diagnostics);
      const msg = JSON.stringify({ error: primaryError?.message || 'Failed to create sub-user', diagnostics });
      toast.error(msg);
      throw new Error(msg);
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
