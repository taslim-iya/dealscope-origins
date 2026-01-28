-- Create on_market_deals table for storing scraped business listings
CREATE TABLE public.on_market_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  asking_price TEXT,
  location TEXT,
  industry TEXT,
  revenue TEXT,
  profit TEXT,
  net_assets TEXT,
  description TEXT,
  ai_summary TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_url)
);

-- Enable RLS
ALTER TABLE public.on_market_deals ENABLE ROW LEVEL SECURITY;

-- Users can view all on-market deals (shared intelligence)
CREATE POLICY "Users can view on-market deals" 
ON public.on_market_deals 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert deals
CREATE POLICY "Authenticated users can insert deals" 
ON public.on_market_deals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create scrape_logs table to track scraping runs
CREATE TABLE public.scrape_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  deals_found INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own scrape logs
CREATE POLICY "Users can view their scrape logs" 
ON public.scrape_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own scrape logs
CREATE POLICY "Users can insert scrape logs" 
ON public.scrape_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own scrape logs
CREATE POLICY "Users can update their scrape logs" 
ON public.scrape_logs 
FOR UPDATE 
USING (auth.uid() = user_id);