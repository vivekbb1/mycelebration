ALTER TABLE public.guest_communications
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS guest_communications_reminder_idx
  ON public.guest_communications (follow_up_on, reminder_sent_at);