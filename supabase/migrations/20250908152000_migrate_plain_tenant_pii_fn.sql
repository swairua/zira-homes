-- RPC to migrate plaintext tenant PII into encrypted columns using encrypt_pii
-- Call with: SELECT public.migrate_plain_tenant_pii(false);

CREATE OR REPLACE FUNCTION public.migrate_plain_tenant_pii(drop_plain boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  rows_processed integer := 0;
BEGIN
  -- Update encrypted columns only when plaintext exists and encrypted is missing
  UPDATE public.tenants
  SET
    phone_encrypted = COALESCE(phone_encrypted, public.encrypt_pii(phone_plain, COALESCE(current_setting('app.encryption_key', true), 'default_key'))),
    national_id_encrypted = COALESCE(national_id_encrypted, public.encrypt_pii(national_id_plain, COALESCE(current_setting('app.encryption_key', true), 'default_key'))),
    emergency_contact_phone_encrypted = COALESCE(emergency_contact_phone_encrypted, public.encrypt_pii(emergency_contact_phone_plain, COALESCE(current_setting('app.encryption_key', true), 'default_key'))),
    emergency_contact_name_encrypted = COALESCE(emergency_contact_name_encrypted, public.encrypt_pii(emergency_contact_name_plain, COALESCE(current_setting('app.encryption_key', true), 'default_key')))
  WHERE (phone_plain IS NOT NULL AND (phone_encrypted IS NULL OR phone_encrypted = ''))
     OR (national_id_plain IS NOT NULL AND (national_id_encrypted IS NULL OR national_id_encrypted = ''))
     OR (emergency_contact_phone_plain IS NOT NULL AND (emergency_contact_phone_encrypted IS NULL OR emergency_contact_phone_encrypted = ''))
     OR (emergency_contact_name_plain IS NOT NULL AND (emergency_contact_name_encrypted IS NULL OR emergency_contact_name_encrypted = ''));

  GET DIAGNOSTICS rows_processed = ROW_COUNT;

  IF drop_plain THEN
    UPDATE public.tenants
    SET phone_plain = NULL, national_id_plain = NULL, emergency_contact_phone_plain = NULL, emergency_contact_name_plain = NULL
    WHERE phone_plain IS NOT NULL OR national_id_plain IS NOT NULL OR emergency_contact_phone_plain IS NOT NULL OR emergency_contact_name_plain IS NOT NULL;
  END IF;

  RETURN json_build_object('ok', true, 'rows_processed', rows_processed);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;
