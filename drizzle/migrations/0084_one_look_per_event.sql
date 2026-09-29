CREATE OR REPLACE FUNCTION public.enforce_one_look_per_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event uuid;
BEGIN
  SELECT event_id INTO _event FROM outfits WHERE id = NEW.outfit_id;
  IF _event IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM reservations r JOIN outfits o ON o.id = r.outfit_id
    WHERE r.guest_id = NEW.guest_id
      AND lower(coalesce(r.guest_name,'')) = lower(coalesce(NEW.guest_name,''))
      AND o.event_id = _event
      AND r.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'ONE_LOOK_PER_EVENT' USING ERRCODE = 'P0001',
      HINT = 'Release the current look for this event before reserving another.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS one_look_per_event ON public.reservations;
CREATE TRIGGER one_look_per_event BEFORE INSERT OR UPDATE OF outfit_id, guest_name ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_look_per_event();