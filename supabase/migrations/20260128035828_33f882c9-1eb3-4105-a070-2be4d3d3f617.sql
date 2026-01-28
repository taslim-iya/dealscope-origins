-- Create enum for mandate status
CREATE TYPE public.mandate_status AS ENUM ('draft', 'active', 'completed');

-- Create domains table (tracks corporate email domains and free allowance)
CREATE TABLE public.domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_name TEXT NOT NULL UNIQUE,
  free_companies_remaining INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  domain_id UUID REFERENCES public.domains(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mandates table
CREATE TABLE public.mandates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES public.domains(id),
  name TEXT NOT NULL,
  notes TEXT,
  country TEXT NOT NULL DEFAULT 'United Kingdom',
  regions TEXT[],
  sic_codes TEXT,
  industry_description TEXT,
  revenue_min NUMERIC,
  revenue_max NUMERIC,
  total_assets_min NUMERIC,
  total_assets_max NUMERIC,
  net_assets_min NUMERIC,
  net_assets_max NUMERIC,
  status public.mandate_status NOT NULL DEFAULT 'draft',
  companies_delivered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create companies table (companies delivered to mandates)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mandate_id UUID NOT NULL REFERENCES public.mandates(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  geography TEXT,
  industry TEXT,
  revenue_band TEXT,
  asset_band TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's domain_id
CREATE OR REPLACE FUNCTION public.get_user_domain_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT domain_id FROM public.profiles WHERE id = user_uuid
$$;

-- RLS Policies for domains
CREATE POLICY "Users can view their own domain"
  ON public.domains FOR SELECT
  USING (id = public.get_user_domain_id(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for mandates
CREATE POLICY "Users can view their own mandates"
  ON public.mandates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own mandates"
  ON public.mandates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own mandates"
  ON public.mandates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own mandates"
  ON public.mandates FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for companies
CREATE POLICY "Users can view companies in their mandates"
  ON public.companies FOR SELECT
  USING (
    mandate_id IN (
      SELECT id FROM public.mandates WHERE user_id = auth.uid()
    )
  );

-- Function to extract domain from email
CREATE OR REPLACE FUNCTION public.extract_email_domain(email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(SPLIT_PART(email, '@', 2))
$$;

-- Function to handle new user signup (creates profile and assigns domain)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  email_domain TEXT;
  domain_record_id UUID;
BEGIN
  user_email := NEW.email;
  email_domain := public.extract_email_domain(user_email);
  
  -- Get or create domain record
  INSERT INTO public.domains (domain_name)
  VALUES (email_domain)
  ON CONFLICT (domain_name) DO NOTHING;
  
  SELECT id INTO domain_record_id
  FROM public.domains
  WHERE domain_name = email_domain;
  
  -- Create profile for new user
  INSERT INTO public.profiles (id, email, domain_id)
  VALUES (NEW.id, user_email, domain_record_id);
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mandates_updated_at
  BEFORE UPDATE ON public.mandates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();