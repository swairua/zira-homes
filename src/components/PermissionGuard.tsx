import { Navigate } from "react-router-dom";
import { useRole } from "@/context/RoleContext";
import { SubUserPermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface PermissionGuardProps {
  permission: keyof SubUserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Guards content based on sub-user permissions
 * - Non-sub-users: Full access
 * - Sub-users: Check specific permission (always enforced)
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { isSubUser, subUserPermissions, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Non-sub-users have full access
  if (!isSubUser) {
    return <>{children}</>;
  }

  // SECURE BY DEFAULT: Check specific permission for sub-users
  // Fail closed: If permissions not loaded or undefined, deny access
  const hasPermission = subUserPermissions?.[permission] === true;

  if (!hasPermission) {
    return fallback || <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
