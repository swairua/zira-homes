import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getGlobalCurrencySync } from "@/utils/currency";
import { Loader2, TestTube2 } from "lucide-react";

interface Props {
  tenantNameQuery?: string; // e.g., "David" or "David Mwangi"
  onPaymentRecorded?: () => void;
}

export const TestPaymentButton: React.FC<Props> = ({ tenantNameQuery = "David", onPaymentRecorded }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const getErr = (e: any) => {
    try {
      if (!e) return "Unknown error";
      if (typeof e === "string") return e;
      const parts: string[] = [];
      if (e.message) parts.push(e.message);
      if (e.details) parts.push(e.details);
      if (e.hint) parts.push(`hint: ${e.hint}`);
      if (parts.length === 0) return JSON.stringify(e);
      return parts.join(" | ");
    } catch {
      return String(e);
    }
  };

  const handleTestPayment = async () => {
    setLoading(true);
    try {
      // 1) Find tenant by name (first or last name matches query)
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name")
        .ilike("first_name", `%${tenantNameQuery}%`);

      if (tenantsError) throw tenantsError;

      let tenant = tenants?.[0];
      if (!tenant) {
        // try last_name match if first_name didn't match
        const { data: tenants2, error: tenantsError2 } = await supabase
          .from("tenants")
          .select("id, first_name, last_name")
          .ilike("last_name", `%${tenantNameQuery}%`);
        if (tenantsError2) throw tenantsError2;
        tenant = tenants2?.[0];
      }

      if (!tenant) {
        throw new Error(`No tenant found matching \"${tenantNameQuery}\"`);
      }

      // 2) Get an active lease for tenant and infer rent amount
      const { data: leases, error: leasesError } = await supabase
        .from("leases")
        .select("id, monthly_rent")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (leasesError) throw leasesError;
      const lease = leases?.[0];
      if (!lease) throw new Error("Tenant has no lease");

      const amount = Number(lease.monthly_rent || 1);

      // 3) Insert payment
      const now = new Date();
      const paymentPayload = {
        tenant_id: tenant.id,
        lease_id: lease.id,
        amount,
        payment_date: now.toISOString().split("T")[0],
        payment_method: "Cash",
        payment_type: "Rent",
        payment_reference: `TEST-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${now.getTime()}`,
        status: "completed"
      } as const;

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert([paymentPayload])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 4) Auto-reconcile unallocated payments for the tenant (if function exists)
      try {
        await supabase.rpc("reconcile_unallocated_payments_for_tenant" as any, { p_tenant_id: tenant.id });
      } catch (e) {
        // soft-fail; reconciliation is optional
        // eslint-disable-next-line no-console
        console.warn("Reconciliation skipped:", e);
      }

      toast({
        title: "Test payment recorded",
        description: `${getGlobalCurrencySync()} ${amount.toLocaleString()} for ${tenant.first_name} ${tenant.last_name}`,
      });

      onPaymentRecorded?.();
    } catch (e) {
      toast({ title: "Payment failed", description: getErr(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleTestPayment} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
      Test Payment
    </Button>
  );
};

export default TestPaymentButton;
