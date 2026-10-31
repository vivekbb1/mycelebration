ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS production_days integer CHECK (production_days IS NULL OR production_days BETWEEN 0 AND 365),
  ADD COLUMN IF NOT EXISTS courier_days integer CHECK (courier_days IS NULL OR courier_days BETWEEN 0 AND 120);
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS default_courier_days integer CHECK (default_courier_days IS NULL OR default_courier_days BETWEEN 0 AND 120),
  ADD COLUMN IF NOT EXISTS delivery_buffer_days integer NOT NULL DEFAULT 0 CHECK (delivery_buffer_days BETWEEN 0 AND 120);

CREATE OR REPLACE FUNCTION public.outfit_production_days(_o public.outfits) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(_o.production_days,
    CASE WHEN jsonb_typeof(_o.sizes) = 'array' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(_o.sizes) s
      WHERE COALESCE((s->>'available')::boolean, true) AND COALESCE((s->>'ready_to_ship')::boolean, false))
    THEN 0 END)
$$;

CREATE OR REPLACE FUNCTION public.enforce_outfit_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.outfits; ev_date date; prod int; cour int; buf int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.outfit_id = OLD.outfit_id THEN RETURN NEW; END IF;
  IF is_celebration_host(NEW.invite_id) THEN RETURN NEW; END IF;
  SELECT * INTO o FROM outfits WHERE id = NEW.outfit_id;
  IF o.id IS NULL OR o.event_id IS NULL THEN RETURN NEW; END IF;
  SELECT event_date INTO ev_date FROM events WHERE id = o.event_id;
  IF ev_date IS NULL THEN RETURN NEW; END IF;
  prod := outfit_production_days(o);
  SELECT COALESCE(o.courier_days, i.default_courier_days), i.delivery_buffer_days INTO cour, buf FROM invites i WHERE i.id = COALESCE(o.invite_id, NEW.invite_id);
  IF prod IS NULL AND o.courier_days IS NULL THEN RETURN NEW; END IF;
  IF current_date + COALESCE(prod,0) + COALESCE(cour,0) + COALESCE(buf,0) > ev_date THEN
    RAISE EXCEPTION 'This outfit can no longer arrive in time for this event';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reservations_delivery_time ON public.reservations;
CREATE TRIGGER reservations_delivery_time BEFORE INSERT OR UPDATE OF outfit_id ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_outfit_delivery();