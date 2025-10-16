-- Validate that billing system is properly configured

-- Ensure billing_plans table has the Starter plan that's shown in the modal
INSERT INTO public.billing_plans (
  id, 
  name, 
  description, 
  price, 
  billing_cycle, 
  max_properties, 
  max_units, 
  sms_credits_included, 
  features,
  billing_model,
  currency,
  is_active
) VALUES (
  gen_random_uuid(),
  'Starter',
  'Perfect for small landlords',
  100.00,
  'monthly',
  5,
  25,
  100,
  '["Basic Financial Reports", "Maintenance Request Management", "Tenant Self-Service Portal", "Email Notifications", "SMS Notifications", "Bulk Operations & Imports", "Automated Billing & Invoicing", "Custom Document Templates"]'::jsonb,
  'fixed',
  'KES',
  true
)
ON CONFLICT (name) DO UPDATE 
SET 
  price = 100.00,
  currency = 'KES',
  billing_model = 'fixed',
  is_active = true,
  updated_at = now();

-- Ensure all existing billing plans have required columns populated
UPDATE public.billing_plans 
SET 
  billing_model = COALESCE(billing_model, 'fixed'),
  currency = COALESCE(currency, 'KES'),
  is_active = COALESCE(is_active, true),
  is_custom = COALESCE(is_custom, false)
WHERE billing_model IS NULL OR currency IS NULL;

-- Create indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_billing_plans_active_currency 
ON public.billing_plans(is_active, currency);

CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_status 
ON public.landlord_subscriptions(status, subscription_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status_payment_type 
ON public.mpesa_transactions(status, payment_type);

-- Add comments to document the schema
COMMENT ON COLUMN public.billing_plans.billing_model IS 'Billing model: fixed (fixed price), percentage (commission-based), or custom';
COMMENT ON COLUMN public.billing_plans.currency IS 'Currency code for the plan price (e.g., KES, USD)';
COMMENT ON COLUMN public.billing_plans.is_custom IS 'Whether this is a custom plan (requires manual contact/approval)';
COMMENT ON COLUMN public.mpesa_transactions.payment_type IS 'Type of payment: rent, service-charge, or plan_upgrade';
COMMENT ON COLUMN public.mpesa_transactions.initiated_by IS 'User ID who initiated the payment';
COMMENT ON COLUMN public.mpesa_transactions.metadata IS 'Additional metadata as JSON (plan details, invoice info, etc.)';
