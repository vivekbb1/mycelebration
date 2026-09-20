ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS outfits_paid_by_host boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.my_outfits_paid_by_host()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT v.outfits_paid_by_host
       FROM public.invite_codes i
       LEFT JOIN public.families f ON f.id = i.family_id
       JOIN public.invites v ON v.id = COALESCE(i.invite_id, f.invite_id)
      WHERE i.claimed_by = auth.uid()
      LIMIT 1),
    true)
$$;