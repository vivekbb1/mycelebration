INSERT INTO public.site_content (key, value, default_value, label, group_name, page_name, kind, sort_order) VALUES
('celebration_page.eyebrow','You''re invited','You''re invited','Small line above the name','Top','Celebration page','text',1),
('celebration_page.title','','','Heading (leave as-is to show the celebration name)','Top','Celebration page','text',2),
('celebration_page.signin','Sign in','Sign in','Sign-in button','Buttons','Celebration page','text',3),
('celebration_page.register','Register our family','Register our family','Register button (registration links only)','Buttons','Celebration page','text',4),
('celebration_page.footnote','Your own events, replies and details appear once you sign in.','Your own events, replies and details appear once you sign in.','Note under the buttons','Bottom','Celebration page','text',5)
ON CONFLICT (key) DO NOTHING;
UPDATE public.site_content SET value='{name}', default_value='{name}', label='Heading ({name} shows the celebration name)' WHERE key='celebration_page.title';

CREATE OR REPLACE FUNCTION public.celebration_by_slug(_slug text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'name', i.name,
    'slug', i.slug,
    'intro', i.public_intro,
    'bg_url', NULLIF(i.public_bg_url, ''),
    'accent', NULLIF(i.public_accent, ''),
    'cover_logo_url', COALESCE(NULLIF(i.public_logo_url, ''), NULLIF(p.settings->>'cover_logo_url', ''), NULLIF(b.cover_logo_url, '')),
    'texts', COALESCE((
      SELECT jsonb_object_agg(s.key, COALESCE(c.value, s.value))
      FROM public.site_content s
      LEFT JOIN public.celebration_content c ON c.invite_id = i.id AND c.key = s.key
      WHERE s.key LIKE 'celebration_page.%'
    ), '{}'::jsonb)
  )
  FROM public.invites i
  LEFT JOIN public.branding_presets p ON p.id = i.branding_preset_id
  LEFT JOIN public.branding b ON b.id = 'default'
  WHERE i.slug IS NOT NULL AND lower(i.slug) = lower(btrim(_slug))
  LIMIT 1
$function$;