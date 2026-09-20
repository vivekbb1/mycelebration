ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS tags text;