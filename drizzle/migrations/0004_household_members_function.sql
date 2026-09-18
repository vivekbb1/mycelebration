CREATE OR REPLACE FUNCTION public.household_members()
RETURNS TABLE (name text, gender text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(i.guest_name), ''), 'Guest') AS name, i.gender
  FROM public.invite_codes i
  WHERE i.household IS NOT NULL
    AND i.household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  ORDER BY 1
$$;

GRANT EXECUTE ON FUNCTION public.household_members() TO authenticated;