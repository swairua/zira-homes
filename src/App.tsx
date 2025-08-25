
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppRoutes } from "@/components/AppRoutes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleProvider } from "@/context/RoleContext";
import { queryClient } from "@/config/queryClient";
import "./App.css";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <RoleProvider>
            <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <BrowserRouter>
                <AppRoutes />
                <Toaster />
              </BrowserRouter>
            </TooltipProvider>
            </QueryClientProvider>
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
