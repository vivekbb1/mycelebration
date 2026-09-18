CREATE TABLE public.branding (
  id text PRIMARY KEY DEFAULT 'default',
  heading_font text NOT NULL DEFAULT 'Marcellus',
  body_font text NOT NULL DEFAULT 'Karla',
  base_font_size integer NOT NULL DEFAULT 16,
  heading_scale numeric NOT NULL DEFAULT 1,
  radius numeric NOT NULL DEFAULT 0.4,
  color_background text NOT NULL DEFAULT '#f9efe8',
  color_foreground text NOT NULL DEFAULT '#57302c',
  color_primary text NOT NULL DEFAULT '#b08637',
  color_primary_foreground text NOT NULL DEFAULT '#fdfaf6',
  color_accent text NOT NULL DEFAULT '#3f7a53',
  color_surface text NOT NULL DEFAULT '#fdf7f2',
  color_border text NOT NULL DEFAULT '#e4d3c6',
  logo_url text,
  logo_height integer NOT NULL DEFAULT 40,
  favicon_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branding TO authenticated;
GRANT ALL ON public.branding TO service_role;

ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read branding"
ON public.branding FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "admins manage branding"
ON public.branding FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.branding (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;