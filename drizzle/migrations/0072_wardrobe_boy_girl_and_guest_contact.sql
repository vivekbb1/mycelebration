ALTER TABLE public.outfit_feeds DROP CONSTRAINT IF EXISTS outfit_feeds_audience_check;
ALTER TABLE public.outfit_feeds ADD CONSTRAINT outfit_feeds_audience_check CHECK (audience = ANY (ARRAY['women','men','kids','boy','girl']));

CREATE OR REPLACE FUNCTION public.my_contact()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'email', COALESCE((SELECT i.email FROM public.invite_codes i WHERE i.claimed_by = auth.uid() AND i.email IS NOT NULL ORDER BY i.claimed_at DESC NULLS LAST LIMIT 1), p.email),
    'phone', COALESCE((SELECT i.phone FROM public.invite_codes i WHERE i.claimed_by = auth.uid() AND i.phone IS NOT NULL ORDER BY i.claimed_at DESC NULLS LAST LIMIT 1), p.phone, p.whatsapp))
  FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.update_my_contact(_email text, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF length(coalesce(_email,'')) > 255 OR length(coalesce(_phone,'')) > 40 THEN RAISE EXCEPTION 'Too long'; END IF;
  UPDATE public.profiles SET email = NULLIF(btrim(_email),''), phone = NULLIF(btrim(_phone),'') WHERE id = auth.uid();
  UPDATE public.invite_codes SET email = NULLIF(btrim(_email),''), phone = NULLIF(btrim(_phone),'') WHERE claimed_by = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.my_contact() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_contact(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_contact() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_contact(text, text) TO authenticated;