CREATE TABLE IF NOT EXISTS public.addons (
  id text PRIMARY KEY,
  name text NOT NULL,
  blurb text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.addons TO authenticated;
GRANT ALL ON public.addons TO service_role;

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can see add-ons"
  ON public.addons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage add-ons"
  ON public.addons FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TRIGGER addons_updated_at BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.host_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  addon_id text NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, addon_id)
);

CREATE INDEX IF NOT EXISTS host_addons_user_idx ON public.host_addons (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_addons TO authenticated;
GRANT ALL ON public.host_addons TO service_role;

ALTER TABLE public.host_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own add-ons or platform admin"
  ON public.host_addons FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Platform admins manage host add-ons"
  ON public.host_addons FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

CREATE OR REPLACE FUNCTION public.my_features()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  extras jsonb;
BEGIN
  IF public.is_platform_admin() THEN
    RETURN '["all"]'::jsonb;
  END IF;

  SELECT COALESCE(p.features, '[]'::jsonb) || COALESCE(s.features_extra, '[]'::jsonb)
    INTO result
  FROM public.host_subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = auth.uid() AND s.status = 'active';

  IF result IS NULL THEN
    SELECT COALESCE(features, '[]'::jsonb) INTO result FROM public.plans WHERE id = 'free';
  END IF;

  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) INTO extras
  FROM public.host_addons ha
  JOIN public.addons a ON a.id = ha.addon_id
  CROSS JOIN LATERAL jsonb_array_elements(a.features) AS f
  WHERE ha.user_id = auth.uid();

  RETURN COALESCE(result, '[]'::jsonb) || COALESCE(extras, '[]'::jsonb);
END;
$function$;

INSERT INTO public.addons (id, name, blurb, features, sort_order) VALUES
  ('wardrobe', 'Wardrobe add-on', 'Outfit picking and look building for guests', '["wardrobe_picker","wardrobe_selector","delivery"]'::jsonb, 1),
  ('branding', 'Branding add-on', 'Fonts, colours, logos and saved themes', '["branding"]'::jsonb, 2),
  ('vendors', 'Vendors add-on', 'Boutiques, ateliers and their orders', '["vendor_management"]'::jsonb, 3),
  ('budget', 'Budget add-on', 'What each function and outfit costs', '["budgeting"]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;
