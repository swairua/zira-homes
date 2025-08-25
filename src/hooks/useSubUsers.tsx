import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SubUser {
  id: string;
  parent_landlord_id: string;
  sub_user_id: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    view_reports: boolean;
  };
  title?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

interface CreateSubUserData {
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubUsers = useCallback(async () => {
    if (!user) {
      setSubUsers([]);
      setLoading(false);
      return;
    }

    try {
      // For now, just return empty array until types are generated
      setSubUsers([]);
      toast({
        title: "Info",
        description: "Sub-user management will be available after database sync",
      });
    } catch (error) {
      console.error('Error fetching sub-users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sub-users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createSubUser = async (data: CreateSubUserData) => {
    if (!user) throw new Error('User not authenticated');

    try {
      toast({
        title: "Info",
        description: "Sub-user creation will be available after database sync",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error creating sub-user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create sub-user",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateSubUserPermissions = async (subUserId: string, permissions: SubUser['permissions']) => {
    try {
      toast({
        title: "Info",
        description: "Permission updates will be available after database sync",
      });
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update permissions",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deactivateSubUser = async (subUserId: string) => {
    try {
      toast({
        title: "Info",
        description: "Sub-user deactivation will be available after database sync",
      });
    } catch (error: any) {
      console.error('Error deactivating sub-user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to revoke access",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchSubUsers();
  }, [fetchSubUsers]);

  return {
    subUsers,
    loading,
    createSubUser,
    updateSubUserPermissions,
    deactivateSubUser,
    refetch: fetchSubUsers
  };
};