CREATE OR REPLACE FUNCTION public.claim_invites_by_email()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _n integer := 0; _hh text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(btrim(email)) INTO _email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF _email IS NULL OR _email = '' THEN RETURN 0; END IF;
  -- Only claim a code when exactly one unclaimed code carries this email per celebration.
  WITH c AS (
    SELECT ic.id FROM public.invite_codes ic
    WHERE lower(btrim(ic.email)) = _email AND ic.claimed_by IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.invite_codes o WHERE o.claimed_by = auth.uid() AND o.invite_id IS NOT DISTINCT FROM ic.invite_id)
  )
  UPDATE public.invite_codes SET claimed_by = auth.uid(), claimed_at = now() WHERE id IN (SELECT id FROM c);
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n > 0 THEN
    SELECT household INTO _hh FROM public.invite_codes WHERE claimed_by = auth.uid() AND household IS NOT NULL ORDER BY claimed_at DESC LIMIT 1;
    UPDATE public.profiles SET invite_claimed = true, household = COALESCE(household, _hh) WHERE id = auth.uid();
  END IF;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.claim_invites_by_email() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_invites_by_email() TO authenticated;