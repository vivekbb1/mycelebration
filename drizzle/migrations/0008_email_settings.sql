CREATE TABLE public.email_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  provider text NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','resend','sendgrid','brevo','none')),
  from_email text,
  from_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage email settings"
  ON public.email_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_settings (id, provider, from_name)
VALUES ('default', 'lovable', 'The Wedding Wardrobe');