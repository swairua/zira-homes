import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";

interface RoleBasedRouteProps {
  children: React.ReactNode;
}

export const RoleBasedRoute = ({ children }: RoleBasedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { effectiveRole, loading: roleLoading } = useRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (location.pathname === "/" && effectiveRole) {
    switch (effectiveRole) {
      case "tenant":
        return <Navigate to="/tenant" replace />;
      case "admin":
        return <Navigate to="/admin" replace />;
      case "landlord":
      case "manager":
      case "agent":
      default:
        // Keep them on the main dashboard
        break;
    }
  }

  // Helper to check if we're in actual tenant area (not /tenants which is for landlords)
  const isTenantArea = location.pathname === "/tenant" || location.pathname.startsWith("/tenant/");

  // Block tenant users from accessing non-tenant routes
  if (effectiveRole === "tenant" && !isTenantArea && location.pathname !== "/auth") {
    return <Navigate to="/tenant" replace />;
  }

  // Block non-tenant users from accessing tenant routes (unless impersonating)
  if (isTenantArea && effectiveRole !== "tenant") {
    return <Navigate to="/" replace />;
  }

  // Block non-admin users from accessing admin routes
  if (location.pathname.startsWith("/admin") && effectiveRole !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
