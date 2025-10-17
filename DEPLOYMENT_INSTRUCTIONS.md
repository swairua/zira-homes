# Deployment Instructions for Billing System Fix

## Overview
This guide walks you through deploying the fixes for the "Checkout error: Edge Function returned a non-2xx status code" issue.

## What Was Fixed

### 1. Database Schema Issues ✅
- **Problem**: `billing_plans` table missing `billing_model`, `currency`, `is_custom`, `contact_link` columns
- **Problem**: `mpesa_transactions` table missing `payment_type`, `initiated_by`, `authorized_by`, `metadata` columns
- **Solution**: Created migrations to add these columns with proper defaults and indexes

### 2. Row Level Security (RLS) Issues ✅
- **Problem**: RLS policies only allowed users with 'Landlord' role to view billing plans
- **Problem**: Edge Functions couldn't access tables due to restrictive policies
- **Solution**: Updated RLS policies to allow authenticated users proper access

### 3. Edge Function Error Handling ✅
- **Problem**: `create-billing-checkout` function could fail with unhelpful error messages
- **Solution**: Enhanced error handling, logging, and phone number validation

---

## Deployment Steps

### Step 1: Apply Database Migrations
Run these migrations in Supabase in the exact order shown:

**Option A: Via Supabase Dashboard**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and run each migration file in this order:
   - `supabase/migrations/20250924000000_fix_billing_plans_schema.sql`
   - `supabase/migrations/20250924000100_fix_mpesa_transactions_schema.sql`
   - `supabase/migrations/20250924000200_fix_billing_plans_rls.sql`
   - `supabase/migrations/20250924000300_fix_rls_for_edge_functions.sql`
   - `supabase/migrations/20250924000400_validate_billing_system.sql`

**Option B: Via Supabase CLI** (if configured)
```bash
supabase db push
```

### Step 2: Verify Migrations Applied
Run this query in Supabase SQL Editor to verify schema:
```sql
-- Check billing_plans columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'billing_plans' 
ORDER BY column_name;

-- Check mpesa_transactions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mpesa_transactions' 
ORDER BY column_name;

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('billing_plans', 'mpesa_transactions', 'landlord_subscriptions')
ORDER BY tablename, policyname;
```

**Expected Results:**
- `billing_plans` should have: `billing_model`, `currency`, `is_custom`, `contact_link`
- `mpesa_transactions` should have: `payment_type`, `initiated_by`, `authorized_by`, `metadata`
- RLS policies should be updated to allow authenticated users

### Step 3: Update Edge Functions
The updated `create-billing-checkout` function is ready. The changes include:
- Better error handling
- Improved phone number validation
- Enhanced logging
- Backward compatibility with missing columns

The function code has been updated in: `supabase/functions/create-billing-checkout/index.ts`

### Step 4: Test the Upgrade Flow

1. **Open your app** in browser
2. **Navigate to Upgrade page**
3. **Select "Starter" plan** (KSh 100.00)
4. **Enter M-Pesa phone number** (e.g., 254712345678 or 0712345678)
5. **Click "Confirm Upgrade"**
6. **Expected Result**: Should receive M-Pesa STK prompt on phone

### Step 5: Verify Success
Check these indicators:

✅ **No "Checkout error" message** when selecting plan  
✅ **M-Pesa prompt appears** on phone after confirmation  
✅ **Transaction record created** in `mpesa_transactions` table  
✅ **Browser console** shows successful logs  

---

## Troubleshooting

### Issue: Still Getting "Checkout error: Edge Function returned a non-2xx status code"

**Check 1: Verify Migrations Applied**
```sql
-- Run this query
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'billing_plans' AND column_name = 'currency';
-- Should return: 1
```

**Check 2: View Function Logs**
1. Go to **Supabase Dashboard** → **Functions**
2. Click on **`create-billing-checkout`**
3. Go to **Logs tab**
4. Look for error messages with `[CREATE-BILLING-CHECKOUT]` prefix
5. Share the error details for debugging

**Check 3: Verify RLS Policies**
```sql
SELECT * FROM pg_policies WHERE tablename = 'billing_plans';
-- Should show policy: "Authenticated users can view active billing plans"
```

**Check 4: Verify Billing Plans Exist**
```sql
SELECT id, name, price, currency, billing_model, is_active 
FROM public.billing_plans 
WHERE is_active = true;
-- Should return at least one active plan
```

### Issue: "Phone number required" error
- Ensure you enter a valid Kenyan phone number
- Format: `254712345678` or `0712345678` (9-15 digits)
- The app will validate and format automatically

### Issue: M-Pesa credentials missing
- Ensure these environment variables are set in Supabase:
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_BUSINESS_SHORTCODE`
  - `MPESA_PASSKEY`

---

## Files Modified/Created

### Migrations Created:
```
✅ supabase/migrations/20250924000000_fix_billing_plans_schema.sql
✅ supabase/migrations/20250924000100_fix_mpesa_transactions_schema.sql
✅ supabase/migrations/20250924000200_fix_billing_plans_rls.sql
✅ supabase/migrations/20250924000300_fix_rls_for_edge_functions.sql
✅ supabase/migrations/20250924000400_validate_billing_system.sql
```

### Files Updated:
```
✅ supabase/functions/create-billing-checkout/index.ts
```

### Documentation Created:
```
✅ BILLING_FIX_SUMMARY.md (detailed explanation)
✅ DEPLOYMENT_INSTRUCTIONS.md (this file)
```

---

## Rollback Plan

If something goes wrong, you can rollback:

1. **Via Supabase Dashboard**: Go to **SQL Editor** and run:
```sql
-- Drop new columns (reverts to before migrations)
ALTER TABLE public.billing_plans 
DROP COLUMN IF EXISTS billing_model, 
DROP COLUMN IF EXISTS currency, 
DROP COLUMN IF EXISTS is_custom, 
DROP COLUMN IF EXISTS contact_link;

ALTER TABLE public.mpesa_transactions 
DROP COLUMN IF EXISTS payment_type, 
DROP COLUMN IF EXISTS initiated_by, 
DROP COLUMN IF EXISTS authorized_by, 
DROP COLUMN IF EXISTS metadata;
```

2. **Re-apply original RLS policies** if needed

---

## Next Steps

1. ✅ Apply all 5 migrations
2. ✅ Verify migrations applied successfully
3. ✅ Test upgrade flow end-to-end
4. ✅ Monitor function logs for any errors
5. ✅ Confirm users can complete upgrade flow

---

## Support

If you encounter issues:
1. Check function logs in Supabase Dashboard
2. Run verification SQL queries provided above
3. Verify all 5 migrations were applied
4. Check environment variables for M-Pesa credentials
5. Review error details in browser console

Contact support if migrations don't apply or function logs show persistent errors.
