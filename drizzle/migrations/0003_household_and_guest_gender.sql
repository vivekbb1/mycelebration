ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS household text,
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS household text,
  ADD COLUMN IF NOT EXISTS gender text;

CREATE INDEX IF NOT EXISTS invite_codes_household_idx ON public.invite_codes (household);
CREATE INDEX IF NOT EXISTS profiles_household_idx ON public.profiles (household);

CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE inv public.invite_codes;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  SELECT * INTO inv FROM public.invite_codes
  WHERE upper(trim(code)) = upper(trim(_code)) LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That invitation code was not recognised');
  END IF;

  IF inv.claimed_by IS NOT NULL AND inv.claimed_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That invitation has already been used');
  END IF;

  UPDATE public.invite_codes
  SET claimed_by = auth.uid(), claimed_at = COALESCE(claimed_at, now())
  WHERE id = inv.id;

  UPDATE public.profiles
  SET invite_claimed = true,
      full_name = CASE WHEN coalesce(full_name, '') = '' THEN inv.guest_name ELSE full_name END,
      household = COALESCE(household, inv.household),
      gender = COALESCE(gender, inv.gender)
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END; $function$;