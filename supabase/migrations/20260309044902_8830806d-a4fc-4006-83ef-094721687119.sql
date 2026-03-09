
-- Add listing type and approval columns to on_market_deals
ALTER TABLE public.on_market_deals
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'scraped',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Existing scraped deals should stay approved, new submissions default to pending
-- We'll handle this in application code

-- Allow authenticated users to insert deals (for owner/broker submissions)
-- Update INSERT policy to allow any authenticated user
DROP POLICY IF EXISTS "Authenticated users can insert deals" ON public.on_market_deals;
CREATE POLICY "Authenticated users can insert deals"
  ON public.on_market_deals FOR INSERT TO authenticated
  WITH CHECK (true);

-- Add UPDATE policy for admins to approve/reject
CREATE POLICY "Admins can update on-market deals"
  ON public.on_market_deals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete on-market deals"
  ON public.on_market_deals FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update SELECT to only show approved deals to non-admins
DROP POLICY IF EXISTS "Anyone can view on-market deals" ON public.on_market_deals;
CREATE POLICY "Users can view approved deals"
  ON public.on_market_deals FOR SELECT
  USING (
    approval_status = 'approved'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR submitted_by = auth.uid()
  );
