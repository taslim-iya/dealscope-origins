-- Create table to store websites that admins can scrape from
CREATE TABLE public.scrape_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  search_query TEXT NOT NULL DEFAULT 'business for sale UK',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scrape_sources ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scrape sources
CREATE POLICY "Admins can view scrape sources"
  ON public.scrape_sources
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scrape sources"
  ON public.scrape_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scrape sources"
  ON public.scrape_sources
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete scrape sources"
  ON public.scrape_sources
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow service role to read for edge functions
CREATE POLICY "Service role can view scrape sources"
  ON public.scrape_sources
  FOR SELECT
  TO service_role
  USING (true);

-- Insert default sources
INSERT INTO public.scrape_sources (name, url, search_query) VALUES
  ('BusinessesForSale', 'businessesforsale.com', 'business for sale UK'),
  ('Daltons', 'daltonsbusiness.com', 'business for sale'),
  ('RightBiz', 'rightbiz.co.uk', 'businesses for sale'),
  ('BizBuySell', 'bizbuysell.com', 'UK business for sale');