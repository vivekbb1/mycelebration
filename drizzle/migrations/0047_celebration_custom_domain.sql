ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS custom_domain text;
CREATE UNIQUE INDEX IF NOT EXISTS invites_custom_domain_unique ON public.invites (lower(custom_domain)) WHERE custom_domain IS NOT NULL;

CREATE OR REPLACE FUNCTION public.celebration_slug_for_domain(_host text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slug FROM public.invites
  WHERE custom_domain IS NOT NULL AND slug IS NOT NULL
    AND lower(custom_domain) = lower(regexp_replace(split_part(_host, ':', 1), '^www\.', ''))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.celebration_slug_for_domain(text) TO anon, authenticated;