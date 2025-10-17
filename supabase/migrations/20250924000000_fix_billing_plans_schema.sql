-- Ensure billing_plans table has all required columns for billing functionality

-- Add billing_model column if it doesn't exist
ALTER TABLE public.billing_plans
ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'fixed' CHECK (billing_model IN ('fixed', 'percentage', 'custom'));

-- Add currency column if it doesn't exist
ALTER TABLE public.billing_plans
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';

-- Add contact_link and is_custom columns for custom plans
ALTER TABLE public.billing_plans
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

ALTER TABLE public.billing_plans
ADD COLUMN IF NOT EXISTS contact_link TEXT;

-- Update any NULL values to defaults
UPDATE public.billing_plans 
SET billing_model = 'fixed', 
    currency = 'KES'
WHERE billing_model IS NULL OR currency IS NULL;

-- Ensure prices are properly formatted
ALTER TABLE public.billing_plans
ALTER COLUMN price SET DEFAULT 0.00;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_billing_plans_active_id ON public.billing_plans(is_active, id);

-- Add check constraint for positive prices
ALTER TABLE public.billing_plans
ADD CONSTRAINT check_positive_price CHECK (price >= 0);
