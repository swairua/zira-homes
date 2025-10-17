import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant" | "System") => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔄 Auth state change:", event, session ? "session exists" : "no session");
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔍 Initial session check:", session ? "session found" : "no session");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("🚪 SignOut function called");
    try {
      // Always clear local state first
      console.log("🧹 Clearing local state");
      setSession(null);
      setUser(null);
      
      // Clear browser storage manually
      console.log("🗑️ Clearing browser storage");
      localStorage.removeItem('sb-kdpqimetajnhcqseajok-auth-token');
      sessionStorage.removeItem('sb-kdpqimetajnhcqseajok-auth-token');
      
      // Attempt to sign out from Supabase with global scope
      console.log("☁️ Calling Supabase signOut with global scope");
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.warn("Supabase signOut error (continuing with local logout):", error);
      } else {
        console.log("✅ Supabase signOut successful");
      }
      
      // Small delay to ensure auth state processes
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.warn("Error during sign out (continuing with local logout):", error);
    } finally {
      // Always navigate to auth page regardless of server response
      console.log("🔄 Redirecting to /auth");
      window.location.href = "/auth";
    }
  };

  const hasRole = useCallback(async (role: "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant" | "System"): Promise<boolean> => {
    if (!user) {
      console.log(`[hasRole] No user, returning false for role: ${role}`);
      return false;
    }

    try {
      // Skip System role check as it's not a valid app_role
      if (role === "System") {
        console.log(`[hasRole] System role check skipped (not a valid app_role)`);
        return false;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', role)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(`[hasRole] Query error for role ${role}:`, error.message);
        return false;
      }

      const hasTheRole = Boolean(data);
      console.log(`[hasRole] User has ${role}:`, hasTheRole);
      return hasTheRole;
    } catch (e: any) {
      const msg = e?.message || JSON.stringify(e);
      console.error(`[hasRole] Error checking role ${role} via user_roles: ${msg}`);
      return false;
    }
  }, [user]);

  const value = {
    user,
    session,
    loading,
    signOut,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
