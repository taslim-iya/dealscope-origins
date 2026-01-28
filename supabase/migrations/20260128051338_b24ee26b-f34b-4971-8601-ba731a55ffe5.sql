-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view on-market deals" ON public.on_market_deals;

-- Create a new policy that allows anyone to view deals (including anonymous/public)
CREATE POLICY "Anyone can view on-market deals"
ON public.on_market_deals
FOR SELECT
USING (true);