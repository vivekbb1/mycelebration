CREATE OR REPLACE FUNCTION public.invites_set_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := COALESCE(NEW.created_by, auth.uid()); END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.invites_add_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.celebration_hosts (invite_id, user_id, role) VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invites_add_owner ON public.invites;
CREATE TRIGGER invites_set_creator BEFORE INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.invites_set_creator();
CREATE TRIGGER invites_add_owner AFTER INSERT ON public.invites FOR EACH ROW EXECUTE FUNCTION public.invites_add_owner();