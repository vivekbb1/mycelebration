ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS ordered_look_title text, ADD COLUMN IF NOT EXISTS ordered_look_image text;
COMMENT ON COLUMN public.reservations.ordered_look_title IS 'Name of the substitute look actually ordered, mirrored from placed host orders. Guest-visible; no prices or shop links.';
COMMENT ON COLUMN public.reservations.ordered_look_image IS 'Photo of the substitute look actually ordered, mirrored from placed host orders. Guest-visible.';

CREATE OR REPLACE FUNCTION public.order_alt_look(_invite uuid, _item jsonb, OUT title text, OUT image text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a jsonb := _item->'alternative'; o record;
BEGIN
 IF a IS NULL OR jsonb_typeof(a) <> 'object' THEN RETURN; END IF;
 title := NULLIF(btrim(a->>'title'),''); image := NULLIF(btrim(a->>'image'),'');
 IF NULLIF(btrim(a->>'sku'),'') IS NOT NULL AND (image IS NULL OR title IS NULL OR title ~* '^alternative\s') THEN
  SELECT x.title, x.image_url INTO o FROM public.outfits x WHERE x.invite_id=_invite AND upper(btrim(x.source_sku))=upper(btrim(a->>'sku')) ORDER BY x.image_url IS NULL, x.created_at LIMIT 1;
  IF FOUND THEN
   IF image IS NULL THEN image := o.image_url; END IF;
   IF title IS NULL OR title ~* '^alternative\s' THEN title := COALESCE(o.title, title); END IF;
  END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.order_alt_look(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_reservation_ordered_size() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND pg_trigger_depth() < 2 AND ((TG_OP='INSERT' AND (NEW.ordered_size IS NOT NULL OR NEW.wearer_note IS NOT NULL OR NEW.ordered_look_title IS NOT NULL OR NEW.ordered_look_image IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.ordered_size IS DISTINCT FROM OLD.ordered_size OR NEW.wearer_note IS DISTINCT FROM OLD.wearer_note OR NEW.ordered_look_title IS DISTINCT FROM OLD.ordered_look_title OR NEW.ordered_look_image IS DISTINCT FROM OLD.ordered_look_image))) THEN
  RAISE EXCEPTION 'Ordered size, ordered look and wearer notes are managed through host orders';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_host_ordered_looks() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; rid uuid; lk record;
BEGIN
 IF NOT public.is_celebration_host(NEW.invite_id) AND COALESCE(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Only celebration hosts can update ordered looks'; END IF;
 IF TG_OP='UPDATE' THEN
  FOR item IN SELECT * FROM jsonb_array_elements(OLD.items) LOOP
   rid := (item->>'reservationId')::uuid;
   IF NEW.status NOT IN ('placed','shipped','delivered') OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.items) n WHERE n->>'reservationId'=rid::text) THEN
    UPDATE public.reservations SET ordered_size=NULL, wearer_note=NULL, ordered_look_title=NULL, ordered_look_image=NULL WHERE id=rid AND invite_id=NEW.invite_id AND (ordered_size IS NOT NULL OR wearer_note IS NOT NULL OR ordered_look_title IS NOT NULL OR ordered_look_image IS NOT NULL);
   END IF;
  END LOOP;
 END IF;
 IF NEW.status IN ('placed','shipped','delivered') THEN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
   rid := (item->>'reservationId')::uuid;
   SELECT * INTO lk FROM public.order_alt_look(NEW.invite_id, item);
   UPDATE public.reservations SET status='confirmed', ordered_size=NULLIF(btrim(item->>'orderedSize'),''), wearer_note=NULLIF(btrim(item->>'wearerNote'),''), ordered_look_title=lk.title, ordered_look_image=lk.image
   WHERE id=rid AND invite_id=NEW.invite_id AND (status IS DISTINCT FROM 'confirmed' OR ordered_size IS DISTINCT FROM NULLIF(btrim(item->>'orderedSize'),'') OR wearer_note IS DISTINCT FROM NULLIF(btrim(item->>'wearerNote'),'') OR ordered_look_title IS DISTINCT FROM lk.title OR ordered_look_image IS DISTINCT FROM lk.image);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_host_ordered_looks() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE o record; item jsonb; lk record;
BEGIN
 FOR o IN SELECT invite_id, items FROM public.wardrobe_orders WHERE status IN ('placed','shipped','delivered') LOOP
  FOR item IN SELECT * FROM jsonb_array_elements(o.items) LOOP
   SELECT * INTO lk FROM public.order_alt_look(o.invite_id, item);
   IF lk.title IS NOT NULL THEN
    UPDATE public.reservations SET ordered_look_title=lk.title, ordered_look_image=lk.image WHERE id=(item->>'reservationId')::uuid AND invite_id=o.invite_id;
   END IF;
  END LOOP;
 END LOOP;
END $$;