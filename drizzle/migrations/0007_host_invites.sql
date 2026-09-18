CREATE TABLE public.host_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  code text NOT NULL UNIQUE,
  invited_by uuid,
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX host_invites_email_idx ON public.host_invites (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_invites TO authenticated;
GRANT ALL ON public.host_invites TO service_role;

ALTER TABLE public.host_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage host invites" ON public.host_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));