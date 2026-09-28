CREATE TABLE public.celebration_creators (
  user_id uuid PRIMARY KEY,
  email text,
  approved_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.celebration_creators TO authenticated;
GRANT ALL ON public.celebration_creators TO service_role;
ALTER TABLE public.celebration_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator manages creators" ON public.celebration_creators FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Users see own approval" ON public.celebration_creators FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_create_celebration()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.celebration_creators WHERE user_id = auth.uid()));
$$;
REVOKE EXECUTE ON FUNCTION public.can_create_celebration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_celebration() TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_celebration_creator(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Only the platform operator can approve'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'No registered account with that email yet'); END IF;
  INSERT INTO public.celebration_creators(user_id, email, approved_by) VALUES (_uid, lower(trim(_email)), auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_celebration_creator(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_celebration_creator(text) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users create a celebration" ON public.invites;
CREATE POLICY "Approved users create a celebration" ON public.invites FOR INSERT TO authenticated
  WITH CHECK (public.can_create_celebration());