import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Header } from "@/components/Header";
import { FloatingTrialCountdown } from "@/components/trial/FloatingTrialCountdown";
import { FloatingActionMenu } from "@/components/dashboard/FloatingActionMenu";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <FloatingTrialCountdown />
        <FloatingActionMenu />
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0 m-0 md:m-0 rounded-none shadow-none">
          <Header />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
            <div className="max-w-full">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}