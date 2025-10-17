-- Drop all billing and subscription related tables
DROP TABLE IF EXISTS public.landlord_subscriptions CASCADE;
DROP TABLE IF EXISTS public.billing_plans CASCADE;
DROP TABLE IF EXISTS public.billing_settings CASCADE;
DROP TABLE IF EXISTS public.automated_billing_settings CASCADE;

-- Keep M-Pesa tables (no changes to these)
-- mpesa_transactions
-- mpesa_credentials
-- landlord_mpesa_configs
-- landlord_payment_preferences