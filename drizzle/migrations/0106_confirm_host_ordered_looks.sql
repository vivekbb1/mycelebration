ALTER TABLE public.reservations ADD COLUMN ordered_size text;
COMMENT ON COLUMN public.reservations.ordered_size IS 'Actual size from a placed host order; original size_choice remains unchanged. Guest-visible, host-order managed.';
CREATE FUNCTION public.guard_reservation_ordered_size() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth() < 2 AND ((TG_OP='INSERT' AND NEW.ordered_size IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.ordered_size IS DISTINCT FROM OLD.ordered_size)) THEN
  RAISE EXCEPTION 'Ordered size is managed through host orders';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservations_guard_ordered_size BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_ordered_size();
CREATE FUNCTION public.sync_host_ordered_looks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; rid uuid;
BEGIN
 IF NOT public.is_celebration_host(NEW.invite_id) AND COALESCE(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Only celebration hosts can update ordered looks'; END IF;
 IF TG_OP='UPDATE' THEN
  FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
   rid := (item->>'reservationId')::uuid;
   IF NEW.status NOT IN ('placed','shipped','delivered') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.items) n WHERE n->>'reservationId'=rid::text) THEN
    UPDATE public.reservations SET ordered_size=NULL WHERE id=rid AND invite_id=NEW.invite_id AND ordered_size IS NOT NULL;
   END IF;
  END LOOP;
 END IF;
 IF NEW.status IN ('placed','shipped','delivered') THEN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
   rid := (item->>'reservationId')::uuid;
   UPDATE public.reservations SET status='confirmed', ordered_size=NULLIF(btrim(item->>'orderedSize'),'')
   WHERE id=rid AND invite_id=NEW.invite_id AND (status IS DISTINCT FROM 'confirmed' OR ordered_size IS DISTINCT FROM NULLIF(btrim(item->>'orderedSize'),''));
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_host_ordered_looks() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wardrobe_orders_sync_guest_looks AFTER INSERT OR UPDATE ON public.wardrobe_orders FOR EACH ROW EXECUTE FUNCTION public.sync_host_ordered_looks();