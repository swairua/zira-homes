This directory contains SQL migration files run against the Supabase/Postgres database.

20250908120000_add_encrypt_iv_wrapper.sql
- Adds compatibility wrapper functions encrypt_iv and decrypt_iv that delegate to pgcrypto's encrypt/decrypt functions.

Rationale:
- Some older migrations referenced encrypt_iv/decrypt_iv which were expected to exist in the database, causing runtime errors when inserting rows that trigger those functions. The wrapper functions accept the same signature and delegate to pgcrypto, providing backwards compatibility.

Note: For production security, review encryption approach and consider using proper authenticated encryption (AES-GCM) and storing IV correctly. The wrappers here are compatibility shims; if you need authenticated encryption, update the encryption/decryption functions accordingly.
