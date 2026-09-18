-- Hosts can record an answer for a guest who has not registered yet.
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS rsvp_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rsvp_note text,
  ADD COLUMN IF NOT EXISTS rsvp_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS rsvp_recorded_by uuid;

CREATE TABLE IF NOT EXISTS public.guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household text NOT NULL,
  author_id uuid,
  author_name text,
  from_host boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_messages_household_idx
  ON public.guest_messages (household, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_messages TO authenticated;
GRANT ALL ON public.guest_messages TO service_role;

ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage all messages"
  ON public.guest_messages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Guests read their household messages"
  ON public.guest_messages FOR SELECT
  TO authenticated
  USING (
    household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Guests write to their household thread"
  ON public.guest_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    from_host = false
    AND author_id = auth.uid()
    AND household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  );