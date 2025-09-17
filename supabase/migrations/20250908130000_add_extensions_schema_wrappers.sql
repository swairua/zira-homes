-- Create wrappers in the "extensions" schema for compatibility with code that resolves functions there.
-- This ensures calls like extensions.encrypt_iv(...) succeed even when search_path or qualification uses the 'extensions' schema.

CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE OR REPLACE FUNCTION "extensions".encrypt_iv(data bytea, key bytea, iv bytea, alg text)
RETURNS bytea
LANGUAGE SQL
AS $$
  SELECT public.encrypt_iv(data, key, iv, alg);
$$;

CREATE OR REPLACE FUNCTION "extensions".decrypt_iv(ciphertext bytea, key bytea, iv bytea, alg text)
RETURNS bytea
LANGUAGE SQL
AS $$
  SELECT public.decrypt_iv(ciphertext, key, iv, alg);
$$;
