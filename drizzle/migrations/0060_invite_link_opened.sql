ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS link_opened_at timestamptz;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS link_opened_at timestamptz;
CREATE OR REPLACE FUNCTION public.mark_invite_opened(_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fam_id uuid;
BEGIN
  IF _code IS NULL OR length(btrim(_code)) < 3 OR length(_code) > 64 THEN RETURN; END IF;
  UPDATE public.invite_codes SET link_opened_at = now()
   WHERE upper(btrim(code)) = upper(btrim(_code)) AND link_opened_at IS NULL;
  UPDATE public.families SET link_opened_at = now()
   WHERE upper(btrim(code)) = upper(btrim(_code)) AND link_opened_at IS NULL
   RETURNING id INTO fam_id;
  IF fam_id IS NOT NULL THEN
    UPDATE public.invite_codes SET link_opened_at = now()
     WHERE family_id = fam_id AND link_opened_at IS NULL;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_invite_opened(text) TO anon, authenticated;