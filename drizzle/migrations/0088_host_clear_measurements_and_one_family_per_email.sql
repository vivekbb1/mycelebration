CREATE POLICY "Hosts clear measurements" ON public.measurements
  FOR DELETE TO authenticated USING (public.is_celebration_host(invite_id));

-- One email belongs to one family per celebration (members of the same family may share).
CREATE OR REPLACE FUNCTION public.guard_email_one_family()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e text := lower(btrim(coalesce(NEW.email, ''))); _other record;
BEGIN
  IF _e = '' OR NEW.invite_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND lower(btrim(coalesce(OLD.email, ''))) = _e THEN RETURN NEW; END IF;
  SELECT guest_name, household INTO _other FROM public.invite_codes
   WHERE invite_id = NEW.invite_id AND id <> NEW.id
     AND lower(btrim(email)) = _e
     AND household IS DISTINCT FROM NEW.household
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'The email % is already on the guest list for % in the "%" family.', NEW.email, _other.guest_name, coalesce(_other.household, 'unnamed')
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS invite_codes_one_family_per_email ON public.invite_codes;
CREATE TRIGGER invite_codes_one_family_per_email
  BEFORE INSERT OR UPDATE OF email, invite_id ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION public.guard_email_one_family();