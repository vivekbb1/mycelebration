ALTER TABLE public.events ADD COLUMN IF NOT EXISTS outfit_choose_by date;

CREATE OR REPLACE FUNCTION public.enforce_outfit_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid; _deadline date; _oid uuid;
BEGIN
  _oid := COALESCE(NEW.outfit_id, OLD.outfit_id);
  _inv := COALESCE(NEW.invite_id, OLD.invite_id);
  IF public.is_platform_admin() OR (_inv IS NOT NULL AND public.is_celebration_host(_inv)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Boutiques updating order details are not choosing looks.
  IF TG_OP = 'UPDATE' AND public.can_boutique_see_outfit(_oid) AND NEW.guest_id <> auth.uid() THEN
    RETURN NEW;
  END IF;
  SELECT e.outfit_choose_by INTO _deadline
  FROM public.outfits o JOIN public.events e ON e.id = o.event_id WHERE o.id = _oid;
  IF _deadline IS NOT NULL AND current_date > _deadline THEN
    RAISE EXCEPTION 'Outfit choices for this event closed on %', to_char(_deadline, 'DD Mon YYYY');
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS reservations_outfit_deadline ON public.reservations;
CREATE TRIGGER reservations_outfit_deadline BEFORE INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_outfit_deadline();