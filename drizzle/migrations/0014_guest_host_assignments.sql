ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS personally_invited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS personally_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS personally_invited_by uuid;

CREATE TABLE public.guest_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, host_id)
);

CREATE INDEX guest_hosts_invite_idx ON public.guest_hosts(invite_id);
CREATE INDEX guest_hosts_host_idx ON public.guest_hosts(host_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_hosts TO authenticated;
GRANT ALL ON public.guest_hosts TO service_role;

ALTER TABLE public.guest_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage guest hosts"
  ON public.guest_hosts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));