import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcProxy } from '@/integrations/supabase/restProxy';
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from '@tanstack/react-query';

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  role: string;
  isPlatformSupport?: boolean;
}

export function useTenantContacts() {
  const { user } = useAuth();

  const { data: contacts = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["tenant-contacts", user?.id],
    queryFn: async (): Promise<ContactInfo[]> => {
      try {
        // Use the dedicated RPC for more reliable contact fetching
        const res = await rpcProxy('get_tenant_contacts', {});
        if (res.error) throw res.error;
        const result = res.data;
        return (result as any)?.contacts || [];
      } catch {
        // Fallback to platform support on any error
        return [{
          name: "Zira Homes Support",
          phone: "+254 757 878 023",
          email: "support@ziratech.com", 
          role: "Platform Support",
          isPlatformSupport: true
        }];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return { 
    contacts, 
    loading, 
    error: error?.message || null, 
    refetch 
  };
}
