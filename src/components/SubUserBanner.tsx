import { useRole } from "@/context/RoleContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

export function SubUserBanner() {
  const { isSubUser } = useRole();

  const { data: landlordName } = useQuery({
    queryKey: ["sub-user-landlord"],
    queryFn: async () => {
      if (!isSubUser) return null;
      
      const { data: subUserData } = await supabase
        .from("sub_users")
        .select("landlord_id")
        .eq("status", "active")
        .maybeSingle();

      if (!subUserData?.landlord_id) return null;

      const { data: landlordProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", subUserData.landlord_id)
        .single();

      if (!landlordProfile) return null;

      return `${landlordProfile.first_name} ${landlordProfile.last_name}`;
    },
    enabled: isSubUser,
  });

  if (!isSubUser) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
      <div className="flex items-center justify-center gap-2 text-sm">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-foreground">
          You are viewing as Sub-User{landlordName && ` for ${landlordName}`}
        </span>
      </div>
    </div>
  );
}
