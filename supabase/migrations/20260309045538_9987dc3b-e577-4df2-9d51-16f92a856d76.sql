
-- Create a dedicated deal_submissions table for the Submit Deal feature
CREATE TABLE public.deal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Company info
  company_name text NOT NULL,
  industry text,
  location text,
  business_summary text,
  revenue text,
  ebitda text,
  asking_price text,
  reason_for_sale text,
  -- Contact info
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  contact_role text NOT NULL DEFAULT 'owner',
  -- Files
  file_urls text[] DEFAULT '{}',
  -- Consent & meta
  consent_given boolean NOT NULL DEFAULT false,
  -- Status & workflow
  status text NOT NULL DEFAULT 'new',
  internal_notes text,
  -- Tracking
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.deal_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (authenticated or not - we want frictionless submissions)
-- But we validate consent in the app
CREATE POLICY "Anyone can submit deals"
  ON public.deal_submissions FOR INSERT
  WITH CHECK (true);

-- Submitters can view their own submissions (if logged in)
CREATE POLICY "Users can view own submissions"
  ON public.deal_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update (status changes, notes)
CREATE POLICY "Admins can update submissions"
  ON public.deal_submissions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete submissions"
  ON public.deal_submissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_deal_submissions_updated_at
  BEFORE UPDATE ON public.deal_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for deal attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-attachments', 'deal-attachments', false)
ON CONFLICT DO NOTHING;

-- Storage policies: anyone can upload to deal-attachments
CREATE POLICY "Anyone can upload deal attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-attachments');

-- Admins and uploaders can view
CREATE POLICY "Authenticated users can view deal attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'deal-attachments');
