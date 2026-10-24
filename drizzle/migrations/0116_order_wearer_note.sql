ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS wearer_note text;
COMMENT ON COLUMN public.reservations.wearer_note IS 'Host note to the wearer (accessories to carry, styling tips) mirrored from placed host orders. Guest-visible, host-order managed.';
CREATE OR REPLACE FUNCTION public.guard_reservation_ordered_size() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF pg_trigger_depth() < 2 AND ((TG_OP='INSERT' AND (NEW.ordered_size IS NOT NULL OR NEW.wearer_note IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.ordered_size IS DISTINCT FROM OLD.ordered_size OR NEW.wearer_note IS DISTINCT FROM OLD.wearer_note))) THEN
  RAISE EXCEPTION 'Ordered size and wearer notes are managed through host orders';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.sync_host_ordered_looks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; rid uuid;
BEGIN
 IF NOT public.is_celebration_host(NEW.invite_id) AND COALESCE(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Only celebration hosts can update ordered looks'; END IF;
 IF TG_OP='UPDATE' THEN
  FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
   rid := (item->>'reservationId')::uuid;
   IF NEW.status NOT IN ('placed','shipped','delivered') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.items) n WHERE n->>'reservationId'=rid::text) THEN
    UPDATE public.reservations SET ordered_size=NULL, wearer_note=NULL WHERE id=rid AND invite_id=NEW.invite_id AND (ordered_size IS NOT NULL OR wearer_note IS NOT NULL);
   END IF;
  END LOOP;
 END IF;
 IF NEW.status IN ('placed','shipped','delivered') THEN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
   rid := (item->>'reservationId')::uuid;
   UPDATE public.reservations SET status='confirmed', ordered_size=NULLIF(btrim(item->>'orderedSize'),''), wearer_note=NULLIF(btrim(item->>'wearerNote'),'')
   WHERE id=rid AND invite_id=NEW.invite_id AND (status IS DISTINCT FROM 'confirmed' OR ordered_size IS DISTINCT FROM NULLIF(btrim(item->>'orderedSize'),'') OR wearer_note IS DISTINCT FROM NULLIF(btrim(item->>'wearerNote'),''));
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_host_ordered_looks() FROM PUBLIC, anon, authenticated;