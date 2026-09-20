ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS public_intro text;

CREATE UNIQUE INDEX IF NOT EXISTS invites_slug_lower_idx
  ON public.invites (lower(slug))
  WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.celebration_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', i.name,
    'intro', i.public_intro,
    'cover_logo_url', COALESCE(
      NULLIF(p.settings->>'cover_logo_url', ''),
      NULLIF(b.cover_logo_url, '')
    )
  )
  FROM public.invites i
  LEFT JOIN public.branding_presets p ON p.id = i.branding_preset_id
  LEFT JOIN public.branding b ON b.id = 'default'
  WHERE i.slug IS NOT NULL
    AND lower(i.slug) = lower(btrim(_slug))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.celebration_by_slug(text) TO anon, authenticated;