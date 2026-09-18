ALTER TABLE public.household_event_invites
  ADD COLUMN IF NOT EXISTS outfit_selection boolean NOT NULL DEFAULT true;