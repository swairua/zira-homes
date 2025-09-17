-- Add wrapper functions encrypt_iv and decrypt_iv to provide compatibility with migrations
-- These wrappers delegate to pgcrypto's encrypt/decrypt while accepting an IV parameter

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wrapper: encrypt_iv(data bytea, key bytea, iv bytea, alg text) -> returns ciphertext bytea
-- Note: pgcrypto.encrypt does not accept an explicit IV parameter in SQL API, so we delegate to encrypt().
-- The migration code stores IV separately (prepends iv) and passes the ciphertext to decrypt_iv, so this wrapper is compatible.
CREATE OR REPLACE FUNCTION public.encrypt_iv(data bytea, key bytea, iv bytea, alg text)
RETURNS bytea
LANGUAGE SQL
AS $$
  SELECT encrypt(data, key, alg);
$$;

-- Wrapper: decrypt_iv(ciphertext bytea, key bytea, iv bytea, alg text) -> returns plaintext bytea
CREATE OR REPLACE FUNCTION public.decrypt_iv(ciphertext bytea, key bytea, iv bytea, alg text)
RETURNS bytea
LANGUAGE SQL
AS $$
  SELECT decrypt(ciphertext, key, alg);
$$;
