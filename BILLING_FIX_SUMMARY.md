# Billing System Fix - Complete Summary

## Issue
Users were getting "Checkout error: Edge Function returned a non-2xx status code" when attempting to upgrade their billing plan.

## Root Causes Identified & Fixed

### 1. **Missing Database Schema Columns**
   - **Problem**: `billing_plans` table was missing `billing_model` and `currency` columns
   - **Problem**: `mpesa_transactions` table was missing `payment_type`, `initiated_by`, `authorized_by`, and `metadata` columns
   - **Fix**: Created migrations to add these columns with proper defaults

   **Migration Files**:
   - `supabase/migrations/20250924000000_fix_billing_plans_schema.sql`
   - `supabase/migrations/20250924000100_fix_mpesa_transactions_schema.sql`

### 2. **Restrictive Row Level Security (RLS) Policies**
   - **Problem**: RLS policies only allowed users with 'Landlord' role to view billing plans
   - **Problem**: Edge Functions couldn't access data due to RLS restrictions
   - **Fix**: Updated RLS policies to allow authenticated users to view active plans and perform necessary operations

   **Migration Files**:
   - `supabase/migrations/20250924000200_fix_billing_plans_rls.sql`
   - `supabase/migrations/20250924000300_fix_rls_for_edge_functions.sql`

### 3. **Edge Function Error Handling**
   - **Problem**: `create-billing-checkout` function could fail silently with missing columns
   - **Fix**: Updated function to:
     - Select specific columns instead of `SELECT *` to avoid serialization issues
     - Provide default values for missing columns (backward compatibility)
     - Add better error logging and diagnostics
     - Validate phone number format more thoroughly
     - Return plan name in response for better UX

   **Modified Files**:
   - `supabase/functions/create-billing-checkout/index.ts`

## Implementation Steps

### For Deployment
1. **Apply all migrations** in the following order:
   ```
   supabase/migrations/20250924000000_fix_billing_plans_schema.sql
   supabase/migrations/20250924000100_fix_mpesa_transactions_schema.sql
   supabase/migrations/20250924000200_fix_billing_plans_rls.sql
   supabase/migrations/20250924000300_fix_rls_for_edge_functions.sql
   ```

2. **Redeploy Edge Functions**:
   - The updated `create-billing-checkout` function is ready to deploy
   - No manual action needed if migrations are applied

3. **Test the flow**:
   - Navigate to Upgrade page
   - Select a plan (e.g., Starter - KSh 100.00)
   - Enter M-Pesa phone number
   - Confirm upgrade
   - Should receive M-Pesa STK push prompt

## What Changed

### Database Schema Changes
```sql
-- billing_plans
ALTER TABLE public.billing_plans
ADD COLUMN billing_model TEXT DEFAULT 'fixed';
ADD COLUMN currency TEXT DEFAULT 'KES';
ADD COLUMN is_custom BOOLEAN DEFAULT false;
ADD COLUMN contact_link TEXT;

-- mpesa_transactions
ALTER TABLE public.mpesa_transactions
ADD COLUMN payment_type TEXT DEFAULT 'rent';
ADD COLUMN initiated_by UUID REFERENCES auth.users(id);
ADD COLUMN authorized_by UUID REFERENCES auth.users(id);
ADD COLUMN metadata JSONB DEFAULT '{}';
```

### RLS Policy Changes
- Changed billing_plans policy from requiring 'Landlord' role to allowing all authenticated users to view active plans
- Updated mpesa_transactions policies to allow Edge Functions and authenticated users proper access
- Updated landlord_subscriptions policies to allow users to manage their own subscriptions

### Edge Function Changes
- Better column selection and error handling
- Improved phone number validation
- Enhanced error messages and logging
- Backward compatibility with missing columns

## Verification Checklist
- [ ] All migrations applied to Supabase database
- [ ] Edge Function logs show no errors
- [ ] User can select plan on Upgrade page
- [ ] Phone number input validates correctly
- [ ] M-Pesa STK push is triggered successfully
- [ ] Transaction record created in mpesa_transactions table
- [ ] Subscription activated after payment

## Troubleshooting

### If Error Persists:
1. Check Supabase function logs for detailed error messages
2. Verify migrations were applied: `SELECT column_name FROM information_schema.columns WHERE table_name='billing_plans'`
3. Check user's auth role: `SELECT * FROM user_roles WHERE user_id = auth.uid()`
4. Verify M-Pesa credentials are configured in environment variables

### Common Issues:
- **"Billing plan not found"**: Check if plan exists and `is_active = true`
- **"Phone number required"**: User must enter valid Kenyan phone number
- **"M-Pesa configuration incomplete"**: Check MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, etc. are set
