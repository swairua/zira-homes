import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/auth': 'Authentication',
  '/tenant': 'Tenant Dashboard',
  '/tenant/payments': 'Payments & Invoices',
  '/tenant/maintenance': 'Maintenance Requests',
  '/tenant/messages': 'Messages',
  '/tenant/profile': 'My Profile',
  '/tenant/support': 'Help & Support',
  '/tenant/payment-preferences': 'Payment Settings',
  '/properties': 'Properties',
  '/units': 'Units',
  '/tenants': 'Tenants',
  '/invoices': 'Invoices',
  '/payments': 'Payments',
  '/expenses': 'Expenses',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/support': 'Support',
  '/knowledge-base': 'Knowledge Base',
  '/notifications': 'Notifications',
  '/sub-users': 'Sub Users',
  '/leases': 'Leases',
  '/maintenance': 'Maintenance Requests',
  '/upgrade': 'Upgrade',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/landlords': 'Landlord Management',
  '/admin/invoices': 'Admin Invoices',
  '/admin/billing': 'Billing Dashboard',
  '/admin/trials': 'Trial Management',
  '/admin/support': 'Support Center',
  '/admin/communication': 'Communication Settings',
  '/admin/payment-config': 'Payment Configuration',
  '/admin/analytics': 'Platform Analytics',
  '/admin/system': 'System Configuration',
  '/admin/pdf-templates': 'PDF Templates',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/bulk-messaging': 'Bulk Messaging',
  '/admin/email-templates': 'Email Templates',
  '/admin/message-templates': 'Message Templates',
  '/landlord/billing': 'Billing Overview',
  '/landlord/billing-details': 'Billing Management',
  '/landlord/payment-settings': 'Payment Settings',
  '/landlord/email-templates': 'Email Templates',
  '/landlord/message-templates': 'Message Templates',
};

const findBestMatchingRoute = (pathname: string): string => {
  // First, try exact match
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  
  // Then try longest prefix match
  const sortedRoutes = Object.keys(routeTitles).sort((a, b) => b.length - a.length);
  for (const route of sortedRoutes) {
    if (route !== '/' && pathname.startsWith(route)) {
      return routeTitles[route];
    }
  }
  
  // Default fallback
  return 'Dashboard';
};

export const useRouteTitle = () => {
  const location = useLocation();
  
  useEffect(() => {
    const title = findBestMatchingRoute(location.pathname);
    document.title = `${title} | Zira Homes`;
  }, [location.pathname]);
  
  return findBestMatchingRoute(location.pathname);
};