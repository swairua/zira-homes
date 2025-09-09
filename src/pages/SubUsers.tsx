import SubUserManagement from "@/components/landlord/SubUserManagement";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

export default function SubUsers() {
  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Sub-User Management</h1>
          <p className="text-muted-foreground">
            Manage sub-users and their permissions for your organization.
          </p>
        </div>
        <FeatureGate 
          feature={FEATURES.SUB_USERS}
          fallbackTitle="Team Management"
          fallbackDescription="Add team members with custom permissions and role-based access control."
          allowReadOnly={true}
          readOnlyMessage="View-only mode - upgrade to manage sub-users"
        >
          <SubUserManagement />
        </FeatureGate>
      </div>
    </DashboardLayout>
  );
}