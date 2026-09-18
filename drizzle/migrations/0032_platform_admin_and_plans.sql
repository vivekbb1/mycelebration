CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE POLICY "See platform admins" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  blurb text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.host_subscriptions (
  user_id uuid PRIMARY KEY,
  plan_id text REFERENCES public.plans(id) ON DELETE SET NULL,
  features_extra jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_subscriptions TO authenticated;
GRANT ALL ON public.host_subscriptions TO service_role;

ALTER TABLE public.host_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own subscription" ON public.host_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Platform admins manage subscriptions" ON public.host_subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TRIGGER host_subscriptions_updated_at BEFORE UPDATE ON public.host_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- What the signed-in host is allowed to use: their plan plus any extras, or
-- everything when they are a platform admin.
CREATE OR REPLACE FUNCTION public.my_features()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
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

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_features() TO authenticated;