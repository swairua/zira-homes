import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarSkeleton } from "@/components/ui/SidebarSkeleton";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { prefetchRoute } from "@/utils/routePrefetch";
import { adminNav, landlordNav, accountNav } from "@/config/navigation";

export function AppSidebar() {
  const { signOut } = useAuth();
  const { open } = useSidebar();
  const { isAdmin, isLandlord, isManager, isAgent, isSubUser, subUserPermissions, loading } = useRole();

  // Show skeleton while role is loading
  if (loading) {
    return <SidebarSkeleton />;
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <NavLink 
          to={isAdmin ? "/admin" : "/"}
          className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <img 
            src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png" 
            alt="Zira Homes" 
            className="h-8 w-8 flex-shrink-0 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/app-icon.png";
            }}
          />
          {open && (
            <span className="font-semibold text-lg text-white">
              Zira Homes
            </span>
          )}
        </NavLink>
      </SidebarHeader>
      
      <SidebarContent className="gap-0.5 py-2">
        {isAdmin && adminNav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-orange-500 h-8 py-1">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items
                  .filter((item) => {
                    // Hide "Sub Users" for non-landlords
                    if (!isLandlord && item.title === "Sub Users") {
                      return false;
                    }
                    return true;
                  })
                  .map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild size="sm">
                          <NavLink 
                            to={item.url}
                            onMouseEnter={() => prefetchRoute(item.url)}
                            className="flex items-center gap-2"
                          >
                            <item.icon className="h-4 w-4" />
                            {open && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {(isLandlord || isManager || isAgent || isSubUser) && !isAdmin && landlordNav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-orange-500 h-8 py-1">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.filter((item) => {
                  // Always hide administrative items from sub-users
                  if (isSubUser) {
                    const subUserBlockedItems = [
                      "Sub Users",
                      "Billing Panel", 
                      "Payment Settings"
                    ];
                    
                    if (subUserBlockedItems.includes(item.title)) {
                      return false;
                    }
                  }

                  // Filter navigation for sub-users based on permissions (SECURE BY DEFAULT)
                  if (isSubUser) {
                    // Whitelist of always-visible items for sub-users
                    const alwaysVisibleForSubUsers = ["Dashboard", "Settings", "Support", "Knowledge Base"];
                    
                    // Always show whitelisted items
                    if (alwaysVisibleForSubUsers.includes(item.title)) {
                      return true;
                    }
                    
                    // Map menu items to required permissions
                    const permissionMap: Record<string, string> = {
                      "Properties": "manage_properties",
                      "Units": "manage_properties",
                      "Tenants": "manage_tenants",
                      "Leases": "manage_leases",
                      "Payments": "manage_payments",
                      "Invoices": "manage_payments",
                      "Reports": "view_reports",
                      "Maintenance": "manage_maintenance",
                      "Expenses": "manage_expenses",
                      "Email Templates": "send_messages",
                      "Message Templates": "send_messages",
                      "Notifications": "view_reports",
                      "Sub Users": "never", // Never show this to sub-users
                      "Billing Panel": "never",
                      "Payment Settings": "never",
                      "Upgrade": "never",
                    };
                    
                    const requiredPermission = permissionMap[item.title];
                    
                    // SECURE BY DEFAULT: If item has no permission mapping or marked as "never", hide it
                    if (!requiredPermission || requiredPermission === "never") {
                      return false;
                    }
                    
                    // FAIL CLOSED: If permissions not loaded yet or permission is false, hide item
                    if (!subUserPermissions || subUserPermissions[requiredPermission] !== true) {
                      return false;
                    }
                  }
                  return true;
                }).map((item) => (
                     <SidebarMenuItem key={item.title}>
                       <SidebarMenuButton asChild size="sm">
                         <NavLink 
                           to={item.url}
                           onMouseEnter={() => prefetchRoute(item.url)}
                           className="flex items-center gap-2"
                         >
                           <item.icon className="h-4 w-4" />
                           {open && <span>{item.title}</span>}
                         </NavLink>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel className="text-orange-500 h-8 py-1">{accountNav.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {accountNav.items
                .filter((item) => {
                  // Hide upgrade for admins and sub-users
                  if ((isAdmin || isSubUser) && item.title === "Upgrade") {
                    return false;
                  }
                  return true;
                })
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLink 
                      to={item.url} 
                      onMouseEnter={() => prefetchRoute(item.url)}
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {open && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}