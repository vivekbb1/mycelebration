ALTER TABLE public.events ADD COLUMN IF NOT EXISTS delivery_cutoff_date date;
COMMENT ON COLUMN public.events.delivery_cutoff_date IS 'Outfits must arrive by this date; guest look eligibility uses it instead of event_date when set (no fitting buffer applied).';

CREATE OR REPLACE FUNCTION public.enforce_outfit_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.outfits; ev_date date; cutoff date; prod int; cour int; buf int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.outfit_id = OLD.outfit_id THEN RETURN NEW; END IF;
  IF is_celebration_host(NEW.invite_id) THEN RETURN NEW; END IF;
  SELECT * INTO o FROM outfits WHERE id = NEW.outfit_id;
  IF o.id IS NULL OR o.event_id IS NULL THEN RETURN NEW; END IF;
  SELECT event_date, delivery_cutoff_date INTO ev_date, cutoff FROM events WHERE id = o.event_id;
  IF ev_date IS NULL AND cutoff IS NULL THEN RETURN NEW; END IF;
  prod := outfit_production_days(o);
  SELECT COALESCE(o.courier_days, i.default_courier_days), i.delivery_buffer_days INTO cour, buf FROM invites i WHERE i.id = COALESCE(o.invite_id, NEW.invite_id);
  IF prod IS NULL AND o.courier_days IS NULL THEN RETURN NEW; END IF;
  IF cutoff IS NOT NULL THEN
    IF current_date + COALESCE(prod,0) + COALESCE(cour,0) > cutoff THEN
      RAISE EXCEPTION 'This outfit can no longer arrive before the delivery cut-off for this event';
    END IF;
  ELSIF current_date + COALESCE(prod,0) + COALESCE(cour,0) + COALESCE(buf,0) > ev_date THEN
    RAISE EXCEPTION 'This outfit can no longer arrive in time for this event';
  END IF;
  RETURN NEW;
END $$;