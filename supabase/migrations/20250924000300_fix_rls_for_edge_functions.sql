-- Ensure mpesa_transactions RLS policies allow proper access
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.mpesa_transactions;

-- Allow authenticated users to insert their own transaction records (for Edge Functions)
CREATE POLICY "Authenticated users can insert transactions"
ON public.mpesa_transactions
FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update transaction status (for callbacks and status checks)
CREATE POLICY "Authenticated users can update transactions"
ON public.mpesa_transactions
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Allow users to view transactions they initiated
CREATE POLICY "Users can view their own transactions"
ON public.mpesa_transactions
FOR SELECT TO authenticated
USING (initiated_by = auth.uid() OR authorized_by = auth.uid());

-- Allow admin/service role to manage all transactions (implicit)

-- Ensure landlord_subscriptions is properly accessible
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.landlord_subscriptions;
DROP POLICY IF EXISTS "Landlords can view their own subscription" ON public.landlord_subscriptions;

-- Allow authenticated users to manage their own subscriptions
CREATE POLICY "Authenticated users can manage their own subscriptions"
ON public.landlord_subscriptions
FOR ALL TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

-- Allow admins to manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.landlord_subscriptions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Fix billing_plans to allow viewing of active plans
DROP POLICY IF EXISTS "Admins can manage billing plans" ON public.billing_plans;
DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;

-- Allow all authenticated users to view active plans
CREATE POLICY "Authenticated users can view active billing plans"
ON public.billing_plans
FOR SELECT TO authenticated
USING (is_active = true);

-- Allow admins to manage all plans
CREATE POLICY "Admins can manage all billing plans"
ON public.billing_plans
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));
