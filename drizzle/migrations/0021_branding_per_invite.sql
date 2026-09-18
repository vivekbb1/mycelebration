ALTER TABLE public.families ADD COLUMN IF NOT EXISTS branding_preset_id uuid REFERENCES public.branding_presets(id) ON DELETE SET NULL;
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS branding_preset_id uuid REFERENCES public.branding_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS families_branding_preset_idx ON public.families (branding_preset_id);
CREATE INDEX IF NOT EXISTS invite_codes_branding_preset_idx ON public.invite_codes (branding_preset_id);

CREATE OR REPLACE FUNCTION public.my_branding()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.settings
  FROM public.invite_codes i
  LEFT JOIN public.families f ON f.id = i.family_id
  JOIN public.branding_presets p
    ON p.id = COALESCE(i.branding_preset_id, f.branding_preset_id)
  WHERE i.claimed_by = auth.uid()
  ORDER BY (i.branding_preset_id IS NOT NULL) DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.my_branding() TO authenticated;