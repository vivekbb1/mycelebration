CREATE OR REPLACE FUNCTION public.snapshot_order_line_prices() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE next_items jsonb; prior jsonb; i jsonb;
BEGIN
 IF TG_OP='INSERT' THEN RETURN NEW; END IF;
 next_items:='[]'::jsonb;
 FOR i IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
  SELECT value INTO prior FROM jsonb_array_elements(OLD.items) WHERE value->>'reservationId'=i->>'reservationId';
  IF prior IS NOT NULL THEN
   IF prior ? 'originalOrderPrice' THEN i:=i || jsonb_build_object('originalOrderPrice',prior->'originalOrderPrice','originalOrderDiscount',prior->'originalOrderDiscount');
   ELSIF (i->'price' IS DISTINCT FROM prior->'price' OR i->'discount' IS DISTINCT FROM prior->'discount' OR i->'alternative' IS DISTINCT FROM prior->'alternative') THEN
    i:=i || jsonb_build_object('originalOrderPrice',prior->'price','originalOrderDiscount',prior->'discount');
   END IF;
  END IF;
  next_items:=next_items || jsonb_build_array(i);
 END LOOP;
 NEW.items:=next_items; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.snapshot_order_line_prices() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER b_snapshot_order_line_prices BEFORE INSERT OR UPDATE OF items ON public.wardrobe_orders FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_line_prices();
DO $$ DECLARE def text; old_rule text := 'IF paid>total AND NEW.status<>''cancelled'' THEN RAISE EXCEPTION ''Payments cannot exceed the order total''; END IF;'; BEGIN
 SELECT pg_get_functiondef('public.guard_wardrobe_order()'::regprocedure) INTO def;
 IF position(old_rule in def)=0 THEN RAISE EXCEPTION 'Order validation definition changed'; END IF;
 def:=replace(def,old_rule,'IF paid>total AND NEW.status<>''cancelled'' THEN IF TG_OP=''INSERT'' THEN RAISE EXCEPTION ''Payments cannot exceed the order total''; ELSIF NEW.payments IS DISTINCT FROM OLD.payments THEN RAISE EXCEPTION ''Additional payments cannot exceed the revised order total; retain the existing advance as vendor credit''; END IF; END IF;');
 EXECUTE def;
END $$;
CREATE OR REPLACE FUNCTION public.save_priced_order_substitution(_reservation_id uuid,_order_id uuid,_alternative jsonb,_size text,_price numeric,_discount numeric,_expected timestamptz,_details jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.wardrobe_orders; result jsonb;
BEGIN
 SELECT * INTO o FROM public.wardrobe_orders WHERE id=_order_id FOR UPDATE;
 IF o.id IS NULL OR NOT public.is_celebration_host(o.invite_id) THEN RAISE EXCEPTION 'Only celebration hosts can substitute outfits'; END IF;
 IF o.updated_at IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Order changed; reopen it before substituting'; END IF;
 IF _discount IS NULL OR _discount<0 OR _discount>_price OR _discount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Discount must be between zero and the replacement price'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) i WHERE i->>'reservationId'=_reservation_id::text) THEN RAISE EXCEPTION 'This look is no longer in the order'; END IF;
 UPDATE public.wardrobe_orders SET items=(SELECT jsonb_agg(CASE WHEN i->>'reservationId'=_reservation_id::text THEN i || jsonb_build_object('price',_price,'discount',_discount) ELSE i END ORDER BY ord) FROM jsonb_array_elements(o.items) WITH ORDINALITY x(i,ord)) WHERE id=o.id RETURNING * INTO o;
 result:=public.save_collection_substitution(_reservation_id,_order_id,_alternative,_size,_price,o.updated_at,_details);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_priced_order_substitution(uuid,uuid,jsonb,text,numeric,numeric,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_priced_order_substitution(uuid,uuid,jsonb,text,numeric,numeric,timestamptz,jsonb) TO authenticated,service_role;