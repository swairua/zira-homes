import React from "react";
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PlanAccessProvider } from "@/context/PlanAccessContext";
import { LandlordOnlyRoute } from "@/components/LandlordOnlyRoute";
import { AdminOnlyRoute } from "@/components/AdminOnlyRoute";
import NotFound from "@/pages/NotFound";

// Import existing pages
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";

// Lazy load tenant pages for better performance
const TenantDashboard = React.lazy(() => import("@/pages/tenant/TenantDashboard"));
const TenantMaintenance = React.lazy(() => import("@/pages/tenant/TenantMaintenance"));
const TenantMessages = React.lazy(() => import("@/pages/tenant/TenantMessages"));
const TenantPaymentPreferences = React.lazy(() => import("@/pages/tenant/TenantPaymentPreferences"));
const TenantPayments = React.lazy(() => import("@/pages/tenant/TenantPayments"));
const TenantProfile = React.lazy(() => import("@/pages/tenant/TenantProfile"));
const TenantSupport = React.lazy(() => import("@/pages/tenant/TenantSupport"));
const FeatureDemo = React.lazy(() => import("@/pages/FeatureDemo"));

// Existing landlord pages
import Properties from "@/pages/Properties";
import Units from "@/pages/Units";
import Tenants from "@/pages/Tenants";
import Invoices from "@/pages/Invoices";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Expenses from "@/pages/Expenses";
import MaintenanceRequestsLandlord from "@/pages/MaintenanceRequestsLandlord";
import Settings from "@/pages/Settings";
import Support from "@/pages/Support";
import Notifications from "@/pages/Notifications";
import Leases from "@/pages/Leases";
import SubUsers from "@/pages/SubUsers";
import { Upgrade } from "@/pages/Upgrade";
import UpgradeSuccess from "@/pages/UpgradeSuccess";
import KnowledgeBase from "@/pages/KnowledgeBase";

// Billing pages
import Billing from "@/pages/landlord/Billing";
import BillingPanel from "@/pages/landlord/BillingPanel";  
import BillingSettings from "@/pages/landlord/BillingSettings";
import EmailTemplates from "@/pages/landlord/EmailTemplates";
import LandlordBillingPage from "@/pages/landlord/LandlordBillingPage";
import MessageTemplates from "@/pages/landlord/MessageTemplates";
import PaymentSettings from "@/pages/landlord/PaymentSettings";
import { Navigate } from "react-router-dom";

// Existing settings pages
import UserManagement from "@/pages/settings/UserManagement";

// Existing admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminInvoicesManagement from "@/pages/admin/AdminInvoicesManagement";
import AuditLogs from "@/pages/admin/AuditLogs";
import BillingDashboard from "@/pages/admin/BillingDashboard";
import BulkMessaging from "@/pages/admin/BulkMessaging";
import CommunicationSettings from "@/pages/admin/CommunicationSettings";
import AdminEmailTemplates from "@/pages/admin/EmailTemplates";
import EnhancedSupportCenter from "@/pages/admin/EnhancedSupportCenter";
import LandlordManagement from "@/pages/admin/LandlordManagement";
import AdminMessageTemplates from "@/pages/admin/MessageTemplates";
import PDFTemplateManager from "@/pages/admin/PDFTemplateManager";
import PaymentConfiguration from "@/pages/admin/PaymentConfiguration";
import PlatformAnalytics from "@/pages/admin/PlatformAnalytics";
import AdminSupportCenter from "@/pages/admin/SupportCenter";
import SystemConfiguration from "@/pages/admin/SystemConfiguration";
import TrialManagement from "@/pages/admin/TrialManagement";
import AdminUserManagement from "@/pages/admin/UserManagement";
import SelfHostedMonitoring from "@/pages/admin/SelfHostedMonitoring";
import BillingPlanManager from "@/pages/admin/BillingPlanManager";

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      
      {/* Tenant routes with lazy loading */}
      <Route
        path="/tenant/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <React.Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<TenantDashboard />} />
                  <Route path="/maintenance" element={<TenantMaintenance />} />
                  <Route path="/messages" element={<TenantMessages />} />
                  <Route path="/payment-preferences" element={<TenantPaymentPreferences />} />
                  <Route path="/payments" element={<TenantPayments />} />
                  <Route path="/profile" element={<TenantProfile />} />
                  <Route path="/support" element={<TenantSupport />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </React.Suspense>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Landlord routes */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <PlanAccessProvider>
                <Routes>
                <Route path="/" element={<Index />} />
                {/* Redirect from /agent/dashboard to main dashboard */}
                <Route path="/agent/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/units" element={<Units />} />
                <Route path="/tenants" element={<Tenants />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/maintenance" element={<MaintenanceRequestsLandlord />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/support" element={<Support />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/sub-users" element={
                  <LandlordOnlyRoute>
                    <SubUsers />
                  </LandlordOnlyRoute>
                } />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/upgrade-success" element={<UpgradeSuccess />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/feature-demo" element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <FeatureDemo />
                  </React.Suspense>
                } />
                
                {/* Payment Settings Route (primary) */}
                <Route path="/payment-settings" element={<PaymentSettings />} />
                
                {/* Legacy Payment Settings Routes (redirects) */}
                <Route path="/billing/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                <Route path="/landlord/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                
                {/* Legacy Sub-Users Route (redirect) */}
                <Route path="/landlord/sub-users" element={<Navigate to="/sub-users" replace />} />
                
                {/* Legacy Template Routes (redirects) */}
                <Route path="/email-templates" element={<Navigate to="/billing/email-templates" replace />} />
                <Route path="/message-templates" element={<Navigate to="/billing/message-templates" replace />} />
                
                {/* Unified Billing Route */}
                <Route path="/billing" element={<Billing />} />
                <Route path="/billing/email-templates" element={<EmailTemplates />} />
                <Route path="/billing/message-templates" element={<MessageTemplates />} />
                
                {/* Legacy routes for backward compatibility */}
                <Route path="/billing/details" element={<Navigate to="/billing" replace />} />
                <Route path="/billing/panel" element={<BillingPanel />} />
                <Route path="/billing/settings" element={<BillingSettings />} />
                <Route path="/billing/landlord-billing" element={<LandlordBillingPage />} />
                
                {/* Settings routes */}
                <Route path="/settings/users" element={<UserManagement />} />
                
                {/* Catch all unknown routes within protected area */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PlanAccessProvider>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RoleBasedRoute>
              <AdminOnlyRoute>
                <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/invoices" element={<AdminInvoicesManagement />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/billing" element={<BillingDashboard />} />
                <Route path="/bulk-messaging" element={<BulkMessaging />} />
                <Route path="/communication" element={<CommunicationSettings />} />
                <Route path="/email-templates" element={<AdminEmailTemplates />} />
                <Route path="/enhanced-support" element={<EnhancedSupportCenter />} />
                <Route path="/landlords" element={<LandlordManagement />} />
                <Route path="/message-templates" element={<AdminMessageTemplates />} />
                <Route path="/pdf-templates" element={<PDFTemplateManager />} />
                <Route path="/payment-config" element={<PaymentConfiguration />} />
                <Route path="/analytics" element={<PlatformAnalytics />} />
                <Route path="/support" element={<AdminSupportCenter />} />
                <Route path="/system" element={<SystemConfiguration />} />
                <Route path="/trials" element={<TrialManagement />} />
                <Route path="/users" element={<AdminUserManagement />} />
                <Route path="/self-hosted" element={<SelfHostedMonitoring />} />
                <Route path="/billing-plans" element={<BillingPlanManager />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </AdminOnlyRoute>
            </RoleBasedRoute>
          </RequireAuth>
        }
      />

      {/* Global fallback route for truly unknown paths */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
