CREATE UNIQUE INDEX wardrobe_orders_vendor_reference_unique ON public.wardrobe_orders (invite_id, lower(shop_name), seller_reference) WHERE seller_reference <> '';
CREATE OR REPLACE FUNCTION public.guard_wardrobe_order() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE item jsonb; payment jsonb; rid uuid; ids uuid[] := ARRAY[]::uuid[]; total numeric:=0; paid numeric:=0; invoiced boolean; BEGIN
 IF jsonb_typeof(NEW.items)<>'array' OR jsonb_array_length(NEW.items)=0 THEN RAISE EXCEPTION 'Select at least one outfit'; END IF;
 IF NEW.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Enter a three-letter currency'; END IF;
 invoiced := NEW.seller_reference <> '' AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.documents) d WHERE d->>'kind'='invoice' AND d->>'number'=NEW.seller_reference AND split_part(d->>'path','/',1)=NEW.invite_id::text);
 IF NEW.status='cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at:=now(); END IF;
 IF NEW.status<>'cancelled' THEN NEW.cancelled_at:=NULL; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
  rid:=(item->>'reservationId')::uuid;
  IF rid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=rid AND invite_id=NEW.invite_id) THEN RAISE EXCEPTION 'Outfits must belong to this celebration and appear only once'; END IF;
  ids:=array_append(ids,rid);
  IF (item->>'price')::numeric IS NULL OR (item->>'discount')::numeric IS NULL OR (item->>'price')::numeric<0 OR (item->>'discount')::numeric<0 OR (item->>'discount')::numeric>(item->>'price')::numeric THEN RAISE EXCEPTION 'Discount must be between zero and the outfit price'; END IF;
  total:=total+(item->>'price')::numeric-(item->>'discount')::numeric;
  IF NEW.status IN ('placed','shipped','delivered') AND NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=rid AND invite_id=NEW.invite_id AND status IN ('reserved','confirmed')) THEN RAISE EXCEPTION 'Each look must still be reserved or confirmed before placing the order'; END IF;
  IF NOT invoiced AND NEW.status IN ('placed','shipped','delivered') AND (item->'measurements' IS NULL OR item->'measurements'='null'::jsonb OR item->'measurements'='{}'::jsonb) THEN RAISE EXCEPTION 'Measurements are required for each wearer before placing the order'; END IF;
  IF NEW.status<>'cancelled' AND EXISTS(SELECT 1 FROM public.wardrobe_orders o, jsonb_array_elements(o.items) oi WHERE o.invite_id=NEW.invite_id AND o.id<>NEW.id AND o.status<>'cancelled' AND oi->>'reservationId'=rid::text) THEN RAISE EXCEPTION 'An outfit is already in another order'; END IF;
 END LOOP;
 total:=total+COALESCE(NEW.courier_charges,0);
 IF jsonb_typeof(NEW.payments)<>'array' THEN RAISE EXCEPTION 'Invalid payments'; END IF;
 FOR payment IN SELECT * FROM jsonb_array_elements(NEW.payments) LOOP
  IF (payment->>'amount')::numeric IS NULL OR (payment->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Payment must be greater than zero'; END IF;
  paid:=paid+(payment->>'amount')::numeric;
 END LOOP;
 IF paid>total AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Payments cannot exceed the order total'; END IF;
 NEW.advance_amount:=COALESCE((SELECT sum((p->>'amount')::numeric) FROM jsonb_array_elements(NEW.payments) p WHERE p->>'kind'='advance'),0);
 NEW.updated_at:=now(); RETURN NEW;
END $function$;