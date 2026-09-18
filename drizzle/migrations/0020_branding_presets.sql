CREATE TABLE public.branding_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  settings JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX branding_presets_name_idx ON public.branding_presets (name);

GRANT SELECT ON public.branding_presets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branding_presets TO authenticated;
GRANT ALL ON public.branding_presets TO service_role;

ALTER TABLE public.branding_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branding presets"
  ON public.branding_presets FOR SELECT
  USING (true);

CREATE POLICY "Admins manage branding presets"
  ON public.branding_presets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));