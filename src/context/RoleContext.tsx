import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { measureApiCall } from "@/utils/performanceMonitor";

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

          // Parallel queries for role resolution
          const [tenantResult, userRolesResult] = await Promise.all([
            supabase
              .from("tenants")
              .select("id")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
          ]);

          // Check user roles FIRST (higher priority roles)
          if (userRolesResult.data && userRolesResult.data.length > 0) {
            // Filter out SubUser roles - they should never be primary
            const allRoles = userRolesResult.data.map(r => r.role.toLowerCase());
            const roles = allRoles.filter(r => r !== 'subuser' && r !== 'landlord_subuser');
            
            setAssignedRoles(roles);
            
            // SECURITY FIX: Only trust selectedRole if it exists in server-verified roles
            const selectedRole = localStorage.getItem('selectedRole');
            if (selectedRole && roles.includes(selectedRole.toLowerCase())) {
              setSelectedRole(selectedRole.toLowerCase());
            } else {
              // Set primary role (highest priority first) - NEVER select SubUser
              if (roles.includes("admin")) {
                setSelectedRole("admin");
                return "admin";
              }
              if (roles.includes("landlord")) {
                setSelectedRole("landlord");
                return "landlord";
              }
              if (roles.includes("manager")) {
                setSelectedRole("manager");
                return "manager";
              }
              if (roles.includes("agent")) {
                setSelectedRole("agent");
                return "agent";
              }
              if (selectedRole && !roles.includes(selectedRole.toLowerCase())) {
                localStorage.removeItem('selectedRole'); // Clean up invalid/unauthorized selection
              }
            }
            
            // Return the primary role for userRole state - NEVER return SubUser
            if (roles.includes("admin")) return "admin";
            if (roles.includes("landlord")) return "landlord";
            if (roles.includes("manager")) return "manager";
            if (roles.includes("agent")) return "agent";
            // If they have roles but none of the above, still check if they're a tenant
          }

          // Check if user is a tenant (lower priority)
          if (tenantResult.data) {
            return "tenant";
          }

          // If user has roles but not the main ones and not a tenant
          if (userRolesResult.data && userRolesResult.data.length > 0) {
            return "tenant"; // fallback
          }

          // Fallback to metadata or default
          return metadataRole?.toLowerCase() || "tenant";
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
        setUserRole("tenant");
        setAssignedRoles(["tenant"]);
        setSelectedRole("tenant");
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
    loading,
    switchRole,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};