import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { measureApiCall } from "@/utils/performanceMonitor";
import { logErrorDetails, toErrorString } from "@/utils/errorExtraction";

interface RoleContextType {
  userRole: string | null;
  effectiveRole: string | null;
  assignedRoles: string[];
  selectedRole: string | null;
  isAdmin: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  isManager: boolean;
  isAgent: boolean;
  isSubUser: boolean;
  subUserPermissions: Record<string, boolean> | null;
  landlordId?: string | null;
  isOnLandlordTrial?: boolean;
  loading: boolean;
  switchRole: (role: string) => void;
}

const RoleContext = createContext<RoleContextType | null>(null);

export const useRole = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
};

interface RoleProviderProps {
  children: ReactNode;
}

export const RoleProvider = ({ children }: RoleProviderProps) => {
  const { user } = useAuth();
  const { isImpersonating, impersonatedRole } = useImpersonation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [subUserPermissions, setSubUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [landlordId, setLandlordId] = useState<string | null>(null);
  const [isOnLandlordTrial, setIsOnLandlordTrial] = useState(false);
  const [loading, setLoading] = useState(true);

  // Optimistic role hydration from localStorage and metadata
  const hydrateFromCache = (user: any) => {
    if (!user) return;
    
    // SECURITY FIX: Don't trust localStorage until server verification
    // Remove optimistic role setting to prevent privilege confusion
    const metadataRole = user.user_metadata?.role?.toLowerCase();
    
    if (metadataRole) {
      setSelectedRole(metadataRole);
      setUserRole(metadataRole);
    }
  };

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setAssignedRoles([]);
      setSelectedRole(null);
      setLoading(false);
      return;
    }

    // Immediate optimistic hydration
    hydrateFromCache(user);

    const fetchUserRole = async () => {
      try {
        const result = await measureApiCall("role-resolution", async () => {
          // Check metadata first (fastest)
          const metadataRole = user.user_metadata?.role;
          
          if (metadataRole === "Tenant") {
            return "tenant";
          }

          // Query user_roles FIRST (avoids tenants recursion for Admins)
          const { data: userRolesResult, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (rolesError) throw rolesError;

          // Check user roles FIRST (higher priority roles)
          if (userRolesResult && userRolesResult.length > 0) {
            const allRoles = userRolesResult.map(r => r.role.toLowerCase());
            
            setAssignedRoles(allRoles);
            
            // Check if user is a SubUser - IMMEDIATELY set role before fetching permissions
            if (allRoles.includes("subuser") || allRoles.includes("landlord_subuser")) {
              // SECURITY FIX: Set role immediately to prevent bypass
              setSelectedRole("subuser");
              
              // Fetch permissions via secure RPC (bypasses RLS issues)
              const { data: subUserData, error: subUserError } = await supabase
                .rpc("get_my_sub_user_permissions");
              
              if (subUserError) {
                console.error("Error fetching sub-user permissions:", subUserError);
              }
              
              // Type-safe access to RPC response
              const subUserInfo = subUserData as { permissions?: Record<string, boolean>; landlord_id?: string; status?: string } | null;
              
              if (subUserInfo?.permissions) {
                setSubUserPermissions(subUserInfo.permissions);
                setLandlordId(subUserInfo.landlord_id || null);
                
                // Check if landlord is on trial
                if (subUserInfo.landlord_id) {
                  const { data: landlordSubscription } = await supabase
                    .from('landlord_subscriptions')
                    .select('status, trial_end_date')
                    .eq('landlord_id', subUserInfo.landlord_id)
                    .eq('status', 'trial')
                    .maybeSingle();
                  
                  if (landlordSubscription) {
                    const trialEndDate = new Date(landlordSubscription.trial_end_date);
                    const today = new Date();
                    const isActive = trialEndDate > today;
                    setIsOnLandlordTrial(isActive);
                  }
                }
              } else {
                // No permissions found - set to empty object (deny all)
                setSubUserPermissions({});
              }
              
              return "subuser";
            }
            
            // SECURITY FIX: Only trust selectedRole if it exists in server-verified roles
            const selectedRole = localStorage.getItem('selectedRole');
            if (selectedRole && allRoles.includes(selectedRole.toLowerCase())) {
              setSelectedRole(selectedRole.toLowerCase());
            } else {
              // Set primary role (highest priority first)
              if (allRoles.includes("admin")) {
                setSelectedRole("admin");
                return "admin";
              }
              if (allRoles.includes("landlord")) {
                setSelectedRole("landlord");
                return "landlord";
              }
              if (allRoles.includes("manager")) {
                setSelectedRole("manager");
                return "manager";
              }
              if (allRoles.includes("agent")) {
                setSelectedRole("agent");
                return "agent";
              }
              if (selectedRole && !allRoles.includes(selectedRole.toLowerCase())) {
                localStorage.removeItem('selectedRole');
              }
            }
            
            // Return the primary role for userRole state
            if (allRoles.includes("admin")) return "admin";
            if (allRoles.includes("landlord")) return "landlord";
            if (allRoles.includes("manager")) return "manager";
            if (allRoles.includes("agent")) return "agent";
          }

          // Only query tenants if no roles found (avoids recursion for Admin/Landlord)
          const { data: tenantResult } = await supabase
            .from("tenants")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (tenantResult) {
            return "tenant";
          }

          // Fallback to metadata or keep current role
          return metadataRole?.toLowerCase() || selectedRole || "tenant";
        });

        // Only update if different from optimistic value
        if (result !== userRole) {
          setUserRole(result);
        }
        
        // Set selected role to stored preference or primary role
        const storedRole = localStorage.getItem('selectedRole');
        if (storedRole && assignedRoles.includes(storedRole)) {
          setSelectedRole(storedRole);
        } else if (!selectedRole || selectedRole !== result) {
          setSelectedRole(result);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        // Don't downgrade on error - keep current role if set
        if (!selectedRole && !userRole) {
          setUserRole("tenant");
          setAssignedRoles(["tenant"]);
          setSelectedRole("tenant");
        }
      } finally {
        setLoading(false);
      }
    };

    // Defer actual API call slightly to allow optimistic render
    setTimeout(fetchUserRole, 0);
  }, [user]);

  // Calculate effective role (considering impersonation and role switching)
  const effectiveRole = (isImpersonating && impersonatedRole)
    ? impersonatedRole.toLowerCase()
    : selectedRole || userRole;

  // Role flags
  const isAdmin = effectiveRole === "admin";
  const isLandlord = effectiveRole === "landlord";
  const isTenant = effectiveRole === "tenant";
  const isManager = effectiveRole === "manager";
  const isAgent = effectiveRole === "agent";
  const isSubUser = effectiveRole === "subuser";

  const switchRole = (role: string) => {
    if (assignedRoles.includes(role)) {
      setSelectedRole(role);
      localStorage.setItem('selectedRole', role);
    }
  };

  const value: RoleContextType = {
    userRole,
    effectiveRole,
    assignedRoles,
    selectedRole,
    isAdmin,
    isLandlord,
    isTenant,
    isManager,
    isAgent,
    isSubUser,
    subUserPermissions,
    landlordId,
    isOnLandlordTrial,
    loading,
    switchRole,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
