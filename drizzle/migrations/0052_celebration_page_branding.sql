ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS public_logo_url text,
  ADD COLUMN IF NOT EXISTS public_bg_url text,
  ADD COLUMN IF NOT EXISTS public_accent text;

CREATE OR REPLACE FUNCTION public.celebration_by_slug(_slug text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'name', i.name,
    'slug', i.slug,
    'intro', i.public_intro,
    'bg_url', NULLIF(i.public_bg_url, ''),
    'accent', NULLIF(i.public_accent, ''),
    'cover_logo_url', COALESCE(
      NULLIF(i.public_logo_url, ''),
      NULLIF(p.settings->>'cover_logo_url', ''),
      NULLIF(b.cover_logo_url, '')
    )
  )
  FROM public.invites i
  LEFT JOIN public.branding_presets p ON p.id = i.branding_preset_id
  LEFT JOIN public.branding b ON b.id = 'default'
  WHERE i.slug IS NOT NULL AND lower(i.slug) = lower(btrim(_slug))
  LIMIT 1
$function$;