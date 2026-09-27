CREATE TABLE public.celebration_email_settings (
  invite_id uuid PRIMARY KEY REFERENCES public.invites(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','resend','sendgrid','brevo','none')),
  from_email text,
  from_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_email_settings TO authenticated;
GRANT ALL ON public.celebration_email_settings TO service_role;
ALTER TABLE public.celebration_email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage their sender" ON public.celebration_email_settings FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.is_celebration_host(invite_id))
  WITH CHECK (public.is_platform_admin() OR public.is_celebration_host(invite_id));

CREATE TABLE public.celebration_content (
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES public.site_content(key) ON DELETE CASCADE,
  value text NOT NULL,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_content TO authenticated;
GRANT ALL ON public.celebration_content TO service_role;
ALTER TABLE public.celebration_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage their wording" ON public.celebration_content FOR ALL TO authenticated
  USING (public.is_platform_admin() OR public.is_celebration_host(invite_id))
  WITH CHECK (public.is_platform_admin() OR public.is_celebration_host(invite_id));
CREATE POLICY "Guests read their wording" ON public.celebration_content FOR SELECT TO authenticated
  USING (public.is_guest_of(invite_id));
CREATE TRIGGER celebration_content_updated BEFORE UPDATE ON public.celebration_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER celebration_email_settings_updated BEFORE UPDATE ON public.celebration_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();