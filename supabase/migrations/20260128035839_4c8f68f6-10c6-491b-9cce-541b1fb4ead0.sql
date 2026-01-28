-- Fix function search_path for extract_email_domain
CREATE OR REPLACE FUNCTION public.extract_email_domain(email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LOWER(SPLIT_PART(email, '@', 2))
$$;