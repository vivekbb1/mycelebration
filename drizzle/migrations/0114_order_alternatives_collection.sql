CREATE OR REPLACE FUNCTION public.collect_order_alternatives() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; alt jsonb; r public.reservations; original public.outfits; replacement public.outfits; next_items jsonb := '[]'::jsonb;
BEGIN
 IF NOT public.is_celebration_host(NEW.invite_id) THEN RAISE EXCEPTION 'Only celebration hosts can save order alternatives'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
  alt := item->'alternative';
  IF jsonb_typeof(alt)='object' AND coalesce(trim(alt->>'title'),'')<>'' AND coalesce(alt->>'outfitId','')='' THEN
   SELECT * INTO r FROM public.reservations WHERE id=(item->>'reservationId')::uuid AND invite_id=NEW.invite_id;
   IF r.id IS NULL THEN RAISE EXCEPTION 'Outfit must belong to this celebration'; END IF;
   SELECT * INTO original FROM public.outfits WHERE id=r.outfit_id AND invite_id=NEW.invite_id;
   SELECT * INTO replacement FROM public.outfits WHERE invite_id=NEW.invite_id AND event_id IS NOT DISTINCT FROM original.event_id AND gender=original.gender AND retired_at IS NULL AND id<>original.id AND ((nullif(trim(alt->>'sku'),'') IS NOT NULL AND source_sku=trim(alt->>'sku')) OR (nullif(trim(alt->>'shop'),'') IS NOT NULL AND boutique_url=trim(alt->>'shop'))) ORDER BY created_at LIMIT 1;
   IF replacement.id IS NULL THEN
    INSERT INTO public.outfits(invite_id,event_id,title,source_sku,designer,boutique_url,image_url,images,price_inr,gender,color_family,garment_type,silhouette,size_note,notes,boutique_id)
    VALUES(NEW.invite_id,original.event_id,trim(alt->>'title'),nullif(trim(alt->>'sku'),''),nullif(trim(alt->>'designer'),''),nullif(trim(alt->>'shop'),''),nullif(trim(alt->>'image'),''),CASE WHEN coalesce(trim(alt->>'image'),'')='' THEN '[]'::jsonb ELSE jsonb_build_array(trim(alt->>'image')) END,(item->>'price')::numeric,original.gender,original.color_family,original.garment_type,original.silhouette,nullif(trim(item->>'orderedSize'),''),original.notes,original.boutique_id) RETURNING * INTO replacement;
   END IF;
   item := jsonb_set(item,'{alternative}',alt || jsonb_build_object('outfitId',replacement.id,'image',coalesce(nullif(alt->>'image',''),replacement.image_url,'')));
   UPDATE public.outfits SET retired_at=coalesce(retired_at,now()) WHERE id=original.id AND invite_id=NEW.invite_id;
  END IF;
  next_items:=next_items || jsonb_build_array(item);
 END LOOP;
 NEW.items:=next_items; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.collect_order_alternatives() FROM PUBLIC;
CREATE TRIGGER a_collect_order_alternatives BEFORE INSERT OR UPDATE OF items ON public.wardrobe_orders FOR EACH ROW EXECUTE FUNCTION public.collect_order_alternatives();