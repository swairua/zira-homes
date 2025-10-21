
-- Fix get_invoice_overview function to remove trial status check
CREATE OR REPLACE FUNCTION public.get_invoice_overview(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  lease_id uuid,
  tenant_id uuid,
  invoice_date date,
  due_date date,
  amount numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  property_id uuid,
  property_owner_id uuid,
  property_manager_id uuid,
  amount_paid_allocated numeric,
  amount_paid_direct numeric,
  amount_paid_total numeric,
  outstanding_amount numeric,
  computed_status text,
  invoice_number text,
  property_name text,
  status text,
  description text,
  first_name text,
  last_name text,
  email text,
  phone text,
  unit_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    i.id,
    i.lease_id,
    i.tenant_id,
    i.invoice_date,
    i.due_date,
    i.amount,
    i.created_at,
    i.updated_at,
    u.property_id,
    p.owner_id as property_owner_id,
    p.manager_id as property_manager_id,
    COALESCE(pa.total_allocated, 0) as amount_paid_allocated,
    COALESCE(py.total_direct, 0) as amount_paid_direct,
    COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0) as amount_paid_total,
    GREATEST(i.amount - (COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0)), 0) as outstanding_amount,
    CASE
      WHEN i.amount <= (COALESCE(pa.total_allocated, 0) + COALESCE(py.total_direct, 0)) THEN 'paid'
      WHEN i.due_date < CURRENT_DATE THEN 'overdue'
      ELSE i.status
    END as computed_status,
    i.invoice_number,
    p.name as property_name,
    i.status,
    i.description,
    t.first_name,
    t.last_name,
    public.mask_sensitive_data(t.email, 3) as email,
    public.mask_sensitive_data(t.phone, 4) as phone,
    u.unit_number
  FROM public.invoices i
  JOIN public.leases l ON l.id = i.lease_id
  JOIN public.units u ON u.id = l.unit_id
  JOIN public.properties p ON p.id = u.property_id
  JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN (
    SELECT pa_inner.invoice_id, SUM(pa_inner.amount) as total_allocated
    FROM public.payment_allocations pa_inner
    GROUP BY pa_inner.invoice_id
  ) pa ON pa.invoice_id = i.id
  LEFT JOIN (
    SELECT py_inner.invoice_id, SUM(py_inner.amount) as total_direct
    FROM public.payments py_inner
    WHERE py_inner.status = 'completed'
    GROUP BY py_inner.invoice_id
  ) py ON py.invoice_id = i.id
  WHERE
    (
      has_role(auth.uid(), 'Admin'::app_role)
      OR p.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR t.user_id = auth.uid()
      OR p.owner_id = public.get_sub_user_landlord(auth.uid())
      OR p.manager_id = public.get_sub_user_landlord(auth.uid())
    )
    AND (p_search IS NULL OR (
      i.invoice_number ILIKE '%' || p_search || '%'
      OR t.first_name ILIKE '%' || p_search || '%'
      OR t.last_name ILIKE '%' || p_search || '%'
      OR p.name ILIKE '%' || p_search || '%'
    ))
    AND (p_status IS NULL OR i.status = p_status)
  ORDER BY i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

-- Check for and remove any RLS policies that reference get_landlord_trial_status
-- Drop the policy on invoices that references the removed function
DROP POLICY IF EXISTS "Sub-users manage invoices during landlord trial" ON public.invoices;
