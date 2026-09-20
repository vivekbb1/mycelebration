ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS fees_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.my_fees_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT v.fees_enabled
       FROM public.invite_codes i
       LEFT JOIN public.families f ON f.id = i.family_id
       JOIN public.invites v ON v.id = COALESCE(i.invite_id, f.invite_id)
      WHERE i.claimed_by = auth.uid()
      LIMIT 1),
    true)
$$;

GRANT EXECUTE ON FUNCTION public.my_fees_enabled() TO authenticated;