import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  role: string;
  isPlatformSupport?: boolean;
}

export function useTenantContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTenantContacts();
    }
  }, [user]);

  const fetchTenantContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the dedicated RPC for more reliable contact fetching
      const { data: result, error: rpcError } = await supabase
        .rpc('get_tenant_contacts')
        .maybeSingle();

      if (rpcError) {
        throw rpcError;
      }

      // Extract contacts from the result
      const contactsList = (result as any)?.contacts || [];
      setContacts(contactsList);

    } catch (err) {
      console.error("Error fetching tenant contacts:", err);
      setError("Failed to load contact information");
      
      // Fallback to platform support on any error
      setContacts([{
        name: "Zira Homes Support",
        phone: "+254 757 878 023",
        email: "support@ziratech.com", 
        role: "Platform Support",
        isPlatformSupport: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return { contacts, loading, error, refetch: fetchTenantContacts };
}