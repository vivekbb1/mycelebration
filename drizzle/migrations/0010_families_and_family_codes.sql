CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage families" ON public.families FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "guests read own family" ON public.families FOR SELECT TO authenticated
  USING (name = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invite_codes_family_id_idx ON public.invite_codes (family_id);

-- Backfill: every existing household becomes a family with a shared code.
INSERT INTO public.families (name, code)
SELECT DISTINCT i.household,
       upper(regexp_replace(split_part(i.household, ' ', array_length(regexp_split_to_array(btrim(i.household), '\s+'), 1)), '[^a-zA-Z]', '', 'g')) || '-' || lpad(((abs(hashtext(i.household)) % 9000) + 1000)::text, 4, '0')
FROM public.invite_codes i
WHERE i.household IS NOT NULL AND btrim(i.household) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.families f WHERE f.name = i.household)
ON CONFLICT DO NOTHING;

UPDATE public.invite_codes i
SET family_id = f.id
FROM public.families f
WHERE i.family_id IS NULL AND i.household = f.name;

-- A family code signs the family in; a personal code still works.
CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE inv public.invite_codes;
        fam public.families;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  SELECT * INTO inv FROM public.invite_codes
  WHERE upper(btrim(code)) = upper(btrim(_code)) LIMIT 1;

  IF inv.id IS NOT NULL THEN
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

    RETURN jsonb_build_object('ok', true, 'household', inv.household);
  END IF;

  SELECT * INTO fam FROM public.families
  WHERE upper(btrim(code)) = upper(btrim(_code)) LIMIT 1;

  IF fam.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That invitation code was not recognised');
  END IF;

  UPDATE public.profiles
  SET invite_claimed = true,
      household = fam.name
  WHERE id = auth.uid();

  UPDATE public.invite_codes
  SET claimed_by = COALESCE(claimed_by, auth.uid()),
      claimed_at = COALESCE(claimed_at, now())
  WHERE family_id = fam.id AND claimed_by IS NULL;

  RETURN jsonb_build_object('ok', true, 'household', fam.name, 'family', true);
END; $function$;