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
    let unsubscribe = () => {};

    // Prefer realtime listener if available
    try {
      if (supabase && supabase.auth && typeof supabase.auth.onAuthStateChange === 'function') {
        const res = supabase.auth.onAuthStateChange((event: any, session: any) => {
          console.log("���� Auth state change:", event, session ? "session exists" : "no session");
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });
        // v2 returns { data: { subscription } }
        unsubscribe = res?.data?.subscription?.unsubscribe ?? (() => {});
      } else {
        console.warn('supabase.auth.onAuthStateChange not available; falling back to session polling');
      }
    } catch (err) {
      console.warn('Error setting up auth listener, falling back to session check', err);
    }

    // THEN check for existing session (safe-guarded)
    (async () => {
      try {
        let sessionData = null;
        if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
          const result = await supabase.auth.getSession();
          sessionData = result?.data?.session ?? null;
          console.log("🔍 Initial session check:", sessionData ? "session found" : "no session");
        }

        // If no session via client SDK, try server-side user endpoint (for cookie-based auth)
        if (!sessionData && typeof window !== 'undefined') {
          try {
            const resp = await fetch('/api/auth/user');
            if (resp.ok) {
              const payload = await resp.json();
              sessionData = null;
              if (payload && payload.user) {
                setUser(payload.user);
              }
            }
          } catch (e) {
            // ignore
          }
        }

        setSession(sessionData);
        setUser(prev => prev ?? sessionData?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('Error getting initial session:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    })();

    return () => {
      try { unsubscribe(); } catch (e) {}
    };
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

      // Attempt to sign out via server-side endpoint (clears server cookies)
      try {
        const resp = await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' });
        if (!resp.ok) {
          console.warn('Server signout returned non-OK status');
        } else {
          console.log('✅ Server signout successful');
        }
      } catch (e) {
        console.warn('Error calling server signout endpoint:', e);
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
    if (!user) return false;
    
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: role
      });
      
      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error(`Error checking ${role} role:`, error);
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
