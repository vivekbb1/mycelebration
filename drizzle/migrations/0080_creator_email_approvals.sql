CREATE TABLE public.celebration_creator_emails (
  email text PRIMARY KEY,
  approved_by uuid DEFAULT auth.uid(),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.celebration_creator_emails TO authenticated;
GRANT ALL ON public.celebration_creator_emails TO service_role;
ALTER TABLE public.celebration_creator_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator manages creator emails" ON public.celebration_creator_emails FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.can_create_celebration()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.celebration_creators WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.celebration_creator_emails
               WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))));
$$;

CREATE OR REPLACE FUNCTION public.approve_celebration_creator(_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _e text := lower(trim(_email));
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Only the platform operator can approve'; END IF;
  IF _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('ok', false, 'error', 'That email doesn''t look right'); END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = _e LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.celebration_creators(user_id, email, approved_by) VALUES (_uid, _e, auth.uid())
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  INSERT INTO public.celebration_creator_emails(email) VALUES (_e) ON CONFLICT (email) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'registered', _uid IS NOT NULL);
END $$;