-- Keep each guest's overall reply in step with their per-event answers.
CREATE OR REPLACE FUNCTION public.sync_household_rsvp(_household text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _yes integer;
  _answered integer;
  _status text;
BEGIN
  IF _household IS NULL OR btrim(_household) = '' THEN
    RETURN;
  END IF;

  SELECT count(*) FILTER (WHERE attending), count(*)
    INTO _yes, _answered
    FROM public.event_attendance
   WHERE household = _household;

  IF _answered = 0 THEN
    _status := 'pending';
  ELSIF _yes > 0 THEN
    _status := 'yes';
  ELSE
    _status := 'no';
  END IF;

  UPDATE public.invite_codes
     SET rsvp_status = _status,
         rsvp_recorded_at = now()
   WHERE household = _household
     AND coalesce(rsvp_status, 'pending') <> _status;

  UPDATE public.profiles
     SET rsvp_status = _status,
         rsvp_updated_at = now()
   WHERE household = _household
     AND coalesce(rsvp_status, 'pending') <> _status;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_attendance_rsvp_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_household_rsvp(OLD.household);
    RETURN OLD;
  END IF;
  PERFORM public.sync_household_rsvp(NEW.household);
  IF TG_OP = 'UPDATE' AND OLD.household IS DISTINCT FROM NEW.household THEN
    PERFORM public.sync_household_rsvp(OLD.household);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendance_rsvp_sync ON public.event_attendance;
CREATE TRIGGER event_attendance_rsvp_sync
AFTER INSERT OR UPDATE OR DELETE ON public.event_attendance
FOR EACH ROW EXECUTE FUNCTION public.event_attendance_rsvp_sync();

-- One-off alignment for answers already on file.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT household FROM public.event_attendance LOOP
    PERFORM public.sync_household_rsvp(r.household);
  END LOOP;
END $$;

-- Households that have replied, for the logistics board.
CREATE OR REPLACE FUNCTION public.household_rsvp_summary()
RETURNS TABLE(household text, status text, events_yes integer, events_answered integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.household,
         CASE WHEN count(*) FILTER (WHERE a.attending) > 0 THEN 'yes' ELSE 'no' END,
         count(*) FILTER (WHERE a.attending)::int,
         count(*)::int
    FROM public.event_attendance a
   GROUP BY a.household
$$;

GRANT EXECUTE ON FUNCTION public.household_rsvp_summary() TO authenticated;
