
-- Fix overly permissive INSERT policy - require submitted_by to match user
DROP POLICY IF EXISTS "Authenticated users can insert deals" ON public.on_market_deals;
CREATE POLICY "Authenticated users can insert deals"
  ON public.on_market_deals FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );
