-- Create outreach messages table
CREATE TABLE public.outreach_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mandate_id UUID NOT NULL REFERENCES public.mandates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'failed')),
  recipient_email TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view their own outreach messages"
ON public.outreach_messages
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own messages
CREATE POLICY "Users can create their own outreach messages"
ON public.outreach_messages
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own messages
CREATE POLICY "Users can update their own outreach messages"
ON public.outreach_messages
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "Users can delete their own outreach messages"
ON public.outreach_messages
FOR DELETE
USING (user_id = auth.uid());

-- Admins can view all messages
CREATE POLICY "Admins can view all outreach messages"
ON public.outreach_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all messages (for sending on behalf)
CREATE POLICY "Admins can update all outreach messages"
ON public.outreach_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_outreach_messages_updated_at
BEFORE UPDATE ON public.outreach_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add outreach_preference to mandates
ALTER TABLE public.mandates 
ADD COLUMN outreach_preference TEXT DEFAULT 'manual' CHECK (outreach_preference IN ('manual', 'assisted', 'automated'));