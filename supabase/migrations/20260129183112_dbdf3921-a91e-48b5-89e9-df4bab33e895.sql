-- Add follow-up reminder configuration to outreach_messages
ALTER TABLE public.outreach_messages
ADD COLUMN follow_up_days integer DEFAULT 7,
ADD COLUMN follow_up_dismissed_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient querying of pending follow-ups
CREATE INDEX idx_outreach_follow_up ON public.outreach_messages (sent_at, status, follow_up_days) 
WHERE sent_at IS NOT NULL AND status IN ('sent', 'opened');