-- Add new columns to companies table for detailed company data
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS description_of_activities TEXT,
ADD COLUMN IF NOT EXISTS companies_house_number TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS revenue NUMERIC,
ADD COLUMN IF NOT EXISTS profit_before_tax NUMERIC,
ADD COLUMN IF NOT EXISTS net_assets NUMERIC,
ADD COLUMN IF NOT EXISTS total_assets NUMERIC;