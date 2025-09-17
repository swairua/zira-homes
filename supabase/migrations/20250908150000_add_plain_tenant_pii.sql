-- Add plaintext PII columns to tenants to store phone/national_id/emergency contact without DB-side encryption
-- WARNING: These columns store sensitive data in plaintext. Use only as a temporary workaround until DB encryption is fixed.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS phone_plain TEXT,
  ADD COLUMN IF NOT EXISTS national_id_plain TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name_plain TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone_plain TEXT;

-- Optional indexes for quick lookups (careful with PII exposure)
CREATE INDEX IF NOT EXISTS idx_tenants_phone_plain ON public.tenants (phone_plain);
CREATE INDEX IF NOT EXISTS idx_tenants_national_id_plain ON public.tenants (national_id_plain);

COMMENT ON COLUMN public.tenants.phone_plain IS 'Plaintext phone number. Temporary - stored without encryption until encryption is fixed.';
COMMENT ON COLUMN public.tenants.national_id_plain IS 'Plaintext national id. Temporary - stored without encryption until encryption is fixed.';
COMMENT ON COLUMN public.tenants.emergency_contact_name_plain IS 'Plaintext emergency contact name. Temporary.';
COMMENT ON COLUMN public.tenants.emergency_contact_phone_plain IS 'Plaintext emergency contact phone. Temporary.';
