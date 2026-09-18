CREATE TABLE public.guest_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  host_id uuid,
  channel text NOT NULL DEFAULT 'call',
  outcome text NOT NULL DEFAULT 'reached',
  notes text,
  follow_up_on date,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_communications_invite_idx ON public.guest_communications (invite_id);
CREATE INDEX guest_communications_follow_up_idx ON public.guest_communications (follow_up_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_communications TO authenticated;
GRANT ALL ON public.guest_communications TO service_role;

ALTER TABLE public.guest_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage guest communications"
ON public.guest_communications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));