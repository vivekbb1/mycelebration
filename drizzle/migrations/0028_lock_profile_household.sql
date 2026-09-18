-- Guests must not be able to move themselves into another family's household.
CREATE OR REPLACE FUNCTION public.guard_profile_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- household may only be filled in when it is still empty (the invite claim path);
  -- once set, it is fixed for the guest.
  IF OLD.household IS NOT NULL AND OLD.household <> '' THEN
    NEW.household := OLD.household;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_household ON public.profiles;
CREATE TRIGGER guard_profile_household
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_household();