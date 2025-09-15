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

  // Try using supabase client's functions.invoke first
  try {
    const { data, error } = await (supabase.functions as any).invoke('create-tenant-account', {
      body,
      headers: { 'x-force-create': 'true' }
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      const msg = (data && (data.error || data.message)) || 'Unknown error creating tenant';
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    console.warn('supabase.functions.invoke failed, attempting direct fetch to Supabase Functions endpoint:', err);

    // Fallback: call Supabase Functions endpoint directly using publishable key
    try {
      // Import constants dynamically to avoid circular import problems
      const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = await import("@/integrations/supabase/client");
      const fnUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-tenant-account`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          'x-force-create': 'true'
        },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = text; }

      if (!res.ok) {
        const details = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`Edge function fetch failed: ${res.status} ${res.statusText} - ${details}`);
      }

      if (!data?.success) {
        const msg = (data && (data.error || data.message)) || 'Unknown error creating tenant';
        throw new Error(msg);
      }

      return data;
    } catch (fetchErr: any) {
      console.error('Direct fetch to edge function also failed:', fetchErr);

      // Last-resort fallback: insert tenant directly (no auth user, no lease)
      try {
        const { data: inserted, error: insertError } = await supabase
          .from('tenants')
          .insert({
            first_name: tenantData.first_name,
            last_name: tenantData.last_name,
            email: tenantData.email,
            phone: tenantData.phone,
            national_id: tenantData.national_id,
            employment_status: tenantData.employment_status,
            profession: tenantData.profession,
            employer_name: tenantData.employer_name,
            monthly_income: tenantData.monthly_income,
            emergency_contact_name: tenantData.emergency_contact_name,
            emergency_contact_phone: tenantData.emergency_contact_phone,
            previous_address: tenantData.previous_address
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        return { success: true, tenant: inserted, isNewUser: false, communicationStatus: { emailSent: false, smsSent: false, errors: [ 'Created without auth account (fallback)' ] } } as any;
      } catch (dbErr: any) {
        const msg = dbErr?.message || String(dbErr);
        throw new Error(`Failed to send a request to the Edge Function; fallback DB insert also failed: ${msg}`);
      }
    }
  }
}
