CREATE TABLE public.celebration_subscriptions (
  invite_id uuid PRIMARY KEY REFERENCES public.invites(id) ON DELETE CASCADE,
  plan_id text REFERENCES public.plans(id) ON DELETE SET NULL,
  features_extra jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_subscriptions TO authenticated;
GRANT ALL ON public.celebration_subscriptions TO service_role;
ALTER TABLE public.celebration_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator manages celebration packages" ON public.celebration_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Hosts see their celebration package" ON public.celebration_subscriptions FOR SELECT TO authenticated
  USING (public.is_celebration_host(invite_id));
CREATE TRIGGER celebration_subscriptions_updated BEFORE UPDATE ON public.celebration_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.celebration_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  addon_id text NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, addon_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_addons TO authenticated;
GRANT ALL ON public.celebration_addons TO service_role;
ALTER TABLE public.celebration_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator manages celebration add-ons" ON public.celebration_addons FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Hosts see their celebration add-ons" ON public.celebration_addons FOR SELECT TO authenticated
  USING (public.is_celebration_host(invite_id));

-- Carry each celebration over from its owners' personal package.
INSERT INTO public.celebration_subscriptions (invite_id, plan_id, features_extra, status)
SELECT DISTINCT ON (ch.invite_id) ch.invite_id, s.plan_id, s.features_extra, s.status
FROM public.celebration_hosts ch
JOIN public.host_subscriptions s ON s.user_id = ch.user_id
LEFT JOIN public.plans p ON p.id = s.plan_id
ORDER BY ch.invite_id, (ch.role = 'owner') DESC, p.sort_order DESC NULLS LAST
ON CONFLICT DO NOTHING;
INSERT INTO public.celebration_addons (invite_id, addon_id)
SELECT DISTINCT ch.invite_id, ha.addon_id
FROM public.celebration_hosts ch JOIN public.host_addons ha ON ha.user_id = ch.user_id
ON CONFLICT DO NOTHING;

ALTER TABLE public.plan_requests ADD COLUMN invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE;
UPDATE public.plan_requests r SET invite_id = (
  SELECT ch.invite_id FROM public.celebration_hosts ch WHERE ch.user_id = r.user_id
  ORDER BY (ch.role = 'owner') DESC, ch.created_at LIMIT 1)
WHERE invite_id IS NULL;
DROP POLICY IF EXISTS "Hosts see their own requests" ON public.plan_requests;
CREATE POLICY "Hosts see their own requests" ON public.plan_requests FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR (invite_id IS NOT NULL AND public.is_celebration_host(invite_id)));
DROP POLICY IF EXISTS "Hosts make their own requests" ON public.plan_requests;
CREATE POLICY "Hosts make their own requests" ON public.plan_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND invite_id IS NOT NULL AND public.is_celebration_host(invite_id));

COMMENT ON TABLE public.host_subscriptions IS 'DEPRECATED: replaced by celebration_subscriptions';
COMMENT ON TABLE public.host_addons IS 'DEPRECATED: replaced by celebration_addons';

CREATE OR REPLACE FUNCTION public.celebration_features(_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb; extras jsonb;
BEGIN
  IF public.is_platform_admin() THEN RETURN '["all"]'::jsonb; END IF;
  IF _invite_id IS NULL OR NOT (public.is_celebration_host(_invite_id) OR public.is_guest_of(_invite_id)) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT COALESCE(p.features, '[]'::jsonb) || COALESCE(s.features_extra, '[]'::jsonb) INTO result
  FROM public.celebration_subscriptions s LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.invite_id = _invite_id AND s.status = 'active';
  IF result IS NULL THEN
    SELECT COALESCE(features, '[]'::jsonb) INTO result FROM public.plans WHERE id = 'free';
  END IF;
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) INTO extras
  FROM public.celebration_addons ca JOIN public.addons a ON a.id = ca.addon_id
  CROSS JOIN LATERAL jsonb_array_elements(a.features) AS f
  WHERE ca.invite_id = _invite_id;
  RETURN COALESCE(result, '[]'::jsonb) || COALESCE(extras, '[]'::jsonb);
END $$;
GRANT EXECUTE ON FUNCTION public.celebration_features(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.celebration_has_feature(_invite_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (f ? _key) OR (f ? 'all') FROM (SELECT public.celebration_features(_invite_id) AS f) x
$$;
GRANT EXECUTE ON FUNCTION public.celebration_has_feature(uuid, text) TO authenticated;

-- Fallback for screens with no celebration chosen: what the caller's first celebration has.
CREATE OR REPLACE FUNCTION public.my_features()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN public.is_platform_admin() THEN '["all"]'::jsonb ELSE COALESCE((
    SELECT public.celebration_features(ch.invite_id) FROM public.celebration_hosts ch
    WHERE ch.user_id = auth.uid() ORDER BY (ch.role = 'owner') DESC, ch.created_at LIMIT 1
  ), (SELECT COALESCE(features, '[]'::jsonb) FROM public.plans WHERE id = 'free'), '[]'::jsonb) END
$$;

DROP POLICY IF EXISTS "Hosts manage budget items" ON public.budget_items;
CREATE POLICY "Hosts manage budget items" ON public.budget_items FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'budgeting'))
  WITH CHECK (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'budgeting'));
DROP POLICY IF EXISTS "Hosts manage vendors" ON public.vendors;
CREATE POLICY "Hosts manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'vendor_management'))
  WITH CHECK (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'vendor_management'));