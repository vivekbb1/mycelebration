CREATE OR REPLACE FUNCTION public.claim_host_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_admin uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  SELECT user_id INTO existing_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;

  IF existing_admin IS NOT NULL THEN
    IF existing_admin = auth.uid() THEN
      RETURN jsonb_build_object('ok', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Host access has already been claimed');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles SET invite_claimed = true WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.claim_host_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_host_access() TO authenticated;
