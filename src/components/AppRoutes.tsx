import React from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleBasedRoute } from "./RoleBasedRoute";
import { DashboardLayout } from "./DashboardLayout";
import { TenantLayout } from "./TenantLayout";

// Import existing pages
import Auth from "../pages/Auth";
import Index from "../pages/Index";
import NotFound from "../pages/NotFound";

// Existing tenant pages
import TenantDashboard from "../pages/tenant/TenantDashboard";
import TenantMaintenance from "../pages/tenant/TenantMaintenance";
import TenantMessages from "../pages/tenant/TenantMessages";
import TenantPaymentPreferences from "../pages/tenant/TenantPaymentPreferences";
import TenantPayments from "../pages/tenant/TenantPayments";
import TenantProfile from "../pages/tenant/TenantProfile";
import TenantSupport from "../pages/tenant/TenantSupport";

// Existing landlord pages
import Properties from "../pages/Properties";
import Units from "../pages/Units";
import Tenants from "../pages/Tenants";
import Invoices from "../pages/Invoices";
import Payments from "../pages/Payments";
import Reports from "../pages/Reports";
import Expenses from "../pages/Expenses";
import MaintenanceRequestsLandlord from "../pages/MaintenanceRequestsLandlord";
import Settings from "../pages/Settings";
import Support from "../pages/Support";
import Notifications from "../pages/Notifications";
import Leases from "../pages/Leases";
import SubUsers from "../pages/SubUsers";
import { Upgrade } from "../pages/Upgrade";
import UpgradeSuccess from "../pages/UpgradeSuccess";
import KnowledgeBase from "../pages/KnowledgeBase";

// Billing pages
import Billing from "../pages/landlord/Billing";
import BillingPanel from "../pages/landlord/BillingPanel";  
import BillingSettings from "../pages/landlord/BillingSettings";
import EmailTemplates from "../pages/landlord/EmailTemplates";
import LandlordBillingPage from "../pages/landlord/LandlordBillingPage";
import MessageTemplates from "../pages/landlord/MessageTemplates";
import PaymentSettings from "../pages/PaymentSettings";
import { Navigate } from "react-router-dom";

// Existing settings pages
import UserManagement from "../pages/settings/UserManagement";

// Existing admin pages
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminInvoicesManagement from "../pages/admin/AdminInvoicesManagement";
import AuditLogs from "../pages/admin/AuditLogs";
import BillingDashboard from "../pages/admin/BillingDashboard";
import BulkMessaging from "../pages/admin/BulkMessaging";
import CommunicationSettings from "../pages/admin/CommunicationSettings";
import AdminEmailTemplates from "../pages/admin/EmailTemplates";
import EnhancedSupportCenter from "../pages/admin/EnhancedSupportCenter";
import LandlordManagement from "../pages/admin/LandlordManagement";
import AdminMessageTemplates from "../pages/admin/MessageTemplates";
import PDFTemplateManager from "../pages/admin/PDFTemplateManager";
import PaymentConfiguration from "../pages/admin/PaymentConfiguration";
import PlatformAnalytics from "../pages/admin/PlatformAnalytics";
import AdminSupportCenter from "../pages/admin/SupportCenter";
import SystemConfiguration from "../pages/admin/SystemConfiguration";
import TrialManagement from "../pages/admin/TrialManagement";
import AdminUserManagement from "../pages/admin/UserManagement";
import SelfHostedMonitoring from "../pages/admin/SelfHostedMonitoring";

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<Auth />} />
      
      {/* Tenant routes */}
      <Route
        path="/tenant/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute>
              <Routes>
                <Route path="/" element={<TenantDashboard />} />
                <Route path="/maintenance" element={<TenantMaintenance />} />
                <Route path="/messages" element={<TenantMessages />} />
                <Route path="/payment-preferences" element={<TenantPaymentPreferences />} />
                <Route path="/payments" element={<TenantPayments />} />
                <Route path="/profile" element={<TenantProfile />} />
                <Route path="/support" element={<TenantSupport />} />
              </Routes>
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      {/* Landlord routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute>
              <Routes>
                <Route path="/" element={<Index />} />
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
                <Route path="/sub-users" element={<SubUsers />} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/upgrade-success" element={<UpgradeSuccess />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                
                {/* Payment Settings Route (primary) */}
                <Route path="/payment-settings" element={<PaymentSettings />} />
                
                {/* Legacy Payment Settings Routes (redirects) */}
                <Route path="/billing/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                <Route path="/landlord/payment-settings" element={<Navigate to="/payment-settings" replace />} />
                
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
              </Routes>
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute>
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
              </Routes>
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
