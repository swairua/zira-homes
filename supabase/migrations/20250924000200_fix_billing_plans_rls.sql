-- Fix RLS policies for billing_plans to ensure Edge Functions can access plans
-- and authenticated users can view active billing plans

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage billing plans" ON public.billing_plans;
DROP POLICY IF EXISTS "Landlords can view active billing plans" ON public.billing_plans;

-- Create new RLS policies that work with authenticated users and Edge Functions
CREATE POLICY "Anyone authenticated can view active billing plans" ON public.billing_plans
FOR SELECT TO authenticated
USING (is_active = true);

-- Allow admins to manage all billing plans
CREATE POLICY "Admins can manage all billing plans" ON public.billing_plans
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Allow service role to bypass RLS entirely (for Edge Functions using service role)
-- This is implicit, but we ensure it's not blocked by row-level policies
