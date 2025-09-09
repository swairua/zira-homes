import { useState, useCallback } from 'react';
import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { rpcProxy, restSelect, restPost, restDelete } from '@/integrations/supabase/restProxy';

export type AppRole = 'Admin' | 'Landlord' | 'Manager' | 'Agent' | 'Tenant';

interface RoleChangeRequest {
  userId: string;
  role: AppRole;
  reason?: string;
}

interface RoleManagementResult {
  success: boolean;
  message: string;
  error?: string;
}

export const useRoleManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const canAssignRole = useCallback(async (targetRole: AppRole): Promise<boolean> => {
    if (!user) return false;

    try {
      const res = await rpcProxy('can_assign_role', { _assigner_id: user.id, _target_role: targetRole });
      if (res.error) {
        console.error('can_assign_role RPC error', res.error);
        return false;
      }
      return Boolean(res.data);
    } catch (error) {
      console.error('Error checking role assignment permission:', error);
      return false;
    }
  }, [user]);

  const canRemoveRole = useCallback(async (targetUserId: string, targetRole: AppRole): Promise<boolean> => {
    if (!user) return false;

    try {
      const res = await rpcProxy('can_remove_role', { _remover_id: user.id, _target_user_id: targetUserId, _target_role: targetRole });
      if (res.error) {
        console.error('can_remove_role RPC error', res.error);
        return false;
      }
      return Boolean(res.data);
    } catch (error) {
      console.error('Error checking role removal permission:', error);
      return false;
    }
  }, [user]);

  const assignRole = useCallback(async (request: RoleChangeRequest): Promise<RoleManagementResult> => {
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    setLoading(true);
    try {
      const hasPermission = await canAssignRole(request.role);
      if (!hasPermission) {
        return { success: false, message: `You don't have permission to assign ${request.role} role` };
      }

      // Check existing role
      const checkRes = await restSelect('user_roles', 'role', { user_id: `eq.${request.userId}`, role: `eq.${request.role}` }, true);
      if (checkRes.error && checkRes.error.status !== 404) throw checkRes.error;
      if (checkRes.data) {
        return { success: false, message: `User already has ${request.role} role` };
      }

      // Assign role
      const postRes = await restPost('user_roles', { user_id: request.userId, role: request.role });
      if (postRes.error) throw postRes.error;

      toast({ title: 'Role Assigned', description: `Successfully assigned ${request.role} role to user` });
      return { success: true, message: `Successfully assigned ${request.role} role` };
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Failed to assign role';
      toast({ title: 'Assignment Failed', description: errorMessage, variant: 'destructive' });
      return { success: false, message: 'Failed to assign role', error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, canAssignRole, toast]);

  const removeRole = useCallback(async (request: RoleChangeRequest): Promise<RoleManagementResult> => {
    if (!user) return { success: false, message: 'User not authenticated' };
    setLoading(true);
    try {
      const hasPermission = await canRemoveRole(request.userId, request.role);
      if (!hasPermission) return { success: false, message: `You don't have permission to remove ${request.role} role` };

      const delRes = await restDelete('user_roles', { user_id: `eq.${request.userId}`, role: `eq.${request.role}` });
      if (delRes.error) throw delRes.error;

      toast({ title: 'Role Removed', description: `Successfully removed ${request.role} role from user` });
      return { success: true, message: `Successfully removed ${request.role} role` };
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Failed to remove role';
      toast({ title: 'Removal Failed', description: errorMessage, variant: 'destructive' });
      return { success: false, message: 'Failed to remove role', error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, canRemoveRole, toast]);

  const getUserRoles = useCallback(async (targetUserId: string): Promise<AppRole[]> => {
    try {
      const res = await restSelect('user_roles', 'role', { user_id: `eq.${targetUserId}` });
      if (res.error) throw res.error;
      let data: any = res.data;
      if (!Array.isArray(data)) {
        if (data && typeof data === 'object' && Array.isArray((data as any).data)) data = (data as any).data;
        else if (data == null || data === '') data = [];
        else data = [data];
      }
      return (data as any[]).map(r => r.role as AppRole) || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }, []);

  const validateRoleHierarchy = useCallback((userRole: AppRole, targetRole: AppRole): boolean => {
    const hierarchy: Record<AppRole, number> = { Admin: 5, Landlord: 4, Manager: 3, Agent: 2, Tenant: 1 };
    return hierarchy[userRole] >= hierarchy[targetRole];
  }, []);

  return { assignRole, removeRole, canAssignRole, canRemoveRole, getUserRoles, validateRoleHierarchy, loading };
};
