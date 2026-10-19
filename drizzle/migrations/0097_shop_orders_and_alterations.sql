CREATE TABLE public.wardrobe_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE, reference text NOT NULL, shop_name text NOT NULL DEFAULT '', currency text NOT NULL DEFAULT 'INR', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','placed','shipped','delivered')), items jsonb NOT NULL DEFAULT '[]', payments jsonb NOT NULL DEFAULT '[]', notes text NOT NULL DEFAULT '', courier text NOT NULL DEFAULT '', tracking_number text NOT NULL DEFAULT '', placed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wardrobe_orders TO authenticated;
GRANT ALL ON public.wardrobe_orders TO service_role;
ALTER TABLE public.wardrobe_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Celebration hosts manage shop orders" ON public.wardrobe_orders FOR ALL TO authenticated USING(public.is_celebration_host(invite_id)) WITH CHECK(public.is_celebration_host(invite_id));
CREATE TABLE public.wardrobe_alterations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE, reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE, vendor_id uuid REFERENCES public.vendors(id), status text NOT NULL DEFAULT 'needed' CHECK(status IN ('needed','with vendor','complete')), measurements jsonb NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '', photos jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(invite_id,reservation_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wardrobe_alterations TO authenticated;
GRANT ALL ON public.wardrobe_alterations TO service_role;
ALTER TABLE public.wardrobe_alterations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Celebration hosts manage alterations" ON public.wardrobe_alterations FOR ALL TO authenticated USING(public.is_celebration_host(invite_id)) WITH CHECK(public.is_celebration_host(invite_id));
CREATE FUNCTION public.guard_wardrobe_order() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE item jsonb; payment jsonb; rid uuid; ids uuid[] := ARRAY[]::uuid[]; total numeric:=0; paid numeric:=0; BEGIN
 IF jsonb_typeof(NEW.items)<>'array' OR jsonb_array_length(NEW.items)=0 THEN RAISE EXCEPTION 'Select at least one outfit'; END IF;
 IF NEW.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Enter a three-letter currency'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
 rid:=(item->>'reservationId')::uuid;
 IF rid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=rid AND invite_id=NEW.invite_id) THEN RAISE EXCEPTION 'Outfits must belong to this celebration and appear only once'; END IF;
 ids:=array_append(ids,rid);
 IF (item->>'price')::numeric IS NULL OR (item->>'discount')::numeric IS NULL OR (item->>'price')::numeric<0 OR (item->>'discount')::numeric<0 OR (item->>'discount')::numeric>(item->>'price')::numeric THEN RAISE EXCEPTION 'Discount must be between zero and the outfit price'; END IF;
 total:=total+(item->>'price')::numeric-(item->>'discount')::numeric;
 IF NEW.status<>'draft' AND NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=rid AND status='confirmed') THEN RAISE EXCEPTION 'Confirm all selected looks before placing the order'; END IF;
 IF NEW.status<>'draft' AND (item->'measurements' IS NULL OR item->'measurements'='null'::jsonb OR item->'measurements'='{}'::jsonb) THEN RAISE EXCEPTION 'Measurements are required for each wearer before placing the order'; END IF;
 IF EXISTS(SELECT 1 FROM public.wardrobe_orders o, jsonb_array_elements(o.items) oi WHERE o.invite_id=NEW.invite_id AND o.id<>NEW.id AND oi->>'reservationId'=rid::text) THEN RAISE EXCEPTION 'An outfit is already in another grouped order'; END IF;
 END LOOP;
 IF jsonb_typeof(NEW.payments)<>'array' THEN RAISE EXCEPTION 'Invalid payments'; END IF;
 FOR payment IN SELECT * FROM jsonb_array_elements(NEW.payments) LOOP
 IF (payment->>'amount')::numeric IS NULL OR (payment->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Part-payment must be greater than zero'; END IF;
 paid:=paid+(payment->>'amount')::numeric;
 END LOOP;
 IF paid>total THEN RAISE EXCEPTION 'Payments cannot exceed the discounted total'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER guard_wardrobe_order BEFORE INSERT OR UPDATE ON public.wardrobe_orders FOR EACH ROW EXECUTE FUNCTION public.guard_wardrobe_order();
CREATE FUNCTION public.guard_wardrobe_alteration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=NEW.reservation_id AND invite_id=NEW.invite_id) THEN RAISE EXCEPTION 'Outfit is not in this celebration'; END IF;
 IF NEW.vendor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=NEW.vendor_id AND invite_id=NEW.invite_id) THEN RAISE EXCEPTION 'Vendor is not in this celebration'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER guard_wardrobe_alteration BEFORE INSERT OR UPDATE ON public.wardrobe_alterations FOR EACH ROW EXECUTE FUNCTION public.guard_wardrobe_alteration();