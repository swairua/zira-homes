-- Add missing columns to mpesa_transactions table that the Edge Functions expect
ALTER TABLE public.mpesa_transactions
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'rent' CHECK (payment_type IN ('rent', 'service-charge', 'plan_upgrade'));

ALTER TABLE public.mpesa_transactions
ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.mpesa_transactions
ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES auth.users(id);

ALTER TABLE public.mpesa_transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_payment_type ON public.mpesa_transactions(payment_type);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_initiated_by ON public.mpesa_transactions(initiated_by);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created_at ON public.mpesa_transactions(created_at DESC);

-- Add a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status_created ON public.mpesa_transactions(status, created_at DESC);
