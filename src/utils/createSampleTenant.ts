import { supabase } from "@/integrations/supabase/client";

export async function createSampleTenantNoLease() {
  // Generate a mostly-unique email to avoid conflicts across retries
  const ts = Date.now();
  const tenantData = {
    first_name: "Jane",
    last_name: "Test",
    email: `jane.test+${ts}@example.com`,
    phone: "+254700000111",
    national_id: "12345678",
    employment_status: "Employed",
    profession: "QA",
    employer_name: "Sample Co",
    monthly_income: 50000,
    emergency_contact_name: "John Test",
    emergency_contact_phone: "+254700000112",
    previous_address: "Nairobi"
  };

  const body = { tenantData, force: true } as const;

  // Invoke edge function with force header to bypass user auth (approved)
  const { data, error } = await (supabase.functions as any).invoke('create-tenant-account', {
    body,
    headers: { 'x-force-create': 'true' }
  });

  if (error) {
    throw new Error(typeof error === 'string' ? error : (error.message || 'Failed to create tenant'));
  }
  if (!data?.success) {
    const msg = (data && (data.error || data.message)) || 'Unknown error creating tenant';
    throw new Error(msg);
  }

  return data;
}
