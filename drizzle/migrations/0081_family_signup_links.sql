CREATE TABLE public.signup_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Family sign-up',
  token text NOT NULL UNIQUE,
  event_ids uuid[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_links TO authenticated;
GRANT ALL ON public.signup_links TO service_role;
ALTER TABLE public.signup_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage their signup links" ON public.signup_links FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id)) WITH CHECK (public.is_celebration_host(invite_id));
CREATE TRIGGER signup_links_updated BEFORE UPDATE ON public.signup_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.families ADD COLUMN signup_link_id uuid REFERENCES public.signup_links(id) ON DELETE SET NULL;
CREATE INDEX families_signup_link_idx ON public.families(signup_link_id);

CREATE OR REPLACE FUNCTION public.signup_link_info(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('label', l.label, 'name', i.name, 'slug', i.slug)
  FROM public.signup_links l JOIN public.invites i ON i.id = l.invite_id
  WHERE l.token = _token AND l.enabled AND length(_token) >= 16
$$;
GRANT EXECUTE ON FUNCTION public.signup_link_info(text) TO anon, authenticated;