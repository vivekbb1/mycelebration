CREATE OR REPLACE FUNCTION public.sync_invite_gender_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.claimed_by IS NOT NULL AND NEW.gender IS DISTINCT FROM OLD.gender THEN
    UPDATE public.profiles SET gender = NEW.gender WHERE id = NEW.claimed_by;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_invite_gender_to_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS invite_codes_sync_gender ON public.invite_codes;
CREATE TRIGGER invite_codes_sync_gender AFTER UPDATE OF gender ON public.invite_codes
FOR EACH ROW EXECUTE FUNCTION public.sync_invite_gender_to_profile();