-- Add CRM tracking columns to outreach_messages table
ALTER TABLE public.outreach_messages 
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS outcome TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update status to support more stages
-- Valid statuses: draft, approved, sent, opened, replied, meeting, closed, failed

-- Create index for faster CRM queries
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON public.outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_mandate_id ON public.outreach_messages(mandate_id);