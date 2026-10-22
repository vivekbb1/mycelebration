ALTER TABLE public.outfits ADD COLUMN retired_at timestamptz DEFAULT NULL;
COMMENT ON COLUMN public.outfits.retired_at IS 'Hidden from future selections; existing reservations and history remain readable.';
CREATE FUNCTION public.guard_retired_outfit_selection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.outfit_id=OLD.outfit_id THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.outfits WHERE id=NEW.outfit_id AND retired_at IS NOT NULL) THEN RAISE EXCEPTION 'This outfit has been retired; choose another look'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_retired_outfit_selection() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reservations_guard_retired BEFORE INSERT OR UPDATE OF outfit_id ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_retired_outfit_selection();
CREATE OR REPLACE FUNCTION public.member_outfit_allowed(_member uuid,_outfit uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM invite_codes c JOIN outfits o ON o.id=_outfit AND o.invite_id=c.invite_id AND o.retired_at IS NULL LEFT JOIN families f ON f.id=c.family_id LEFT JOIN signup_links l ON l.id=f.signup_link_id WHERE c.id=_member AND ((l.outfit_min_price IS NULL AND l.outfit_max_price IS NULL) OR (o.price_inr IS NOT NULL AND (l.outfit_min_price IS NULL OR o.price_inr>=l.outfit_min_price) AND (l.outfit_max_price IS NULL OR o.price_inr<=l.outfit_max_price))))
$$;
CREATE FUNCTION public.save_collection_substitution(_reservation_id uuid,_order_id uuid DEFAULT NULL,_alternative jsonb DEFAULT NULL,_size text DEFAULT NULL,_price numeric DEFAULT NULL,_expected timestamptz DEFAULT NULL,_details jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reservations; original public.outfits; replacement public.outfits; alt jsonb; rid uuid; gender_value text;
BEGIN
 SELECT * INTO r FROM public.reservations WHERE id=_reservation_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.is_celebration_host(r.invite_id) THEN RAISE EXCEPTION 'Only celebration hosts can substitute outfits'; END IF;
 SELECT * INTO original FROM public.outfits WHERE id=r.outfit_id;
 IF jsonb_typeof(_alternative) IS DISTINCT FROM 'object' OR COALESCE(btrim(_alternative->>'title'),'')='' OR COALESCE(btrim(_size),'')='' OR _price IS NULL OR _price<0 OR _price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter an outfit name, replacement size and valid price'; END IF;
 alt:=_alternative;
 IF COALESCE(alt->>'outfitId','')<>'' THEN
  SELECT * INTO replacement FROM public.outfits WHERE id=(alt->>'outfitId')::uuid AND invite_id=r.invite_id AND retired_at IS NULL;
  IF replacement.id IS NULL OR replacement.id=original.id THEN RAISE EXCEPTION 'Choose a different active outfit from this celebration'; END IF;
 ELSE
  gender_value:=COALESCE(NULLIF(_details->>'gender',''),original.gender);
  IF gender_value NOT IN ('men','women','boy','girl') THEN RAISE EXCEPTION 'Choose a valid wardrobe audience'; END IF;
  INSERT INTO public.outfits(invite_id,event_id,title,source_sku,designer,boutique_url,image_url,images,price_inr,gender,color_family,garment_type,silhouette,size_note,sizes,notes,boutique_id)
  VALUES(r.invite_id,original.event_id,btrim(alt->>'title'),NULLIF(btrim(alt->>'sku'),''),NULLIF(btrim(alt->>'designer'),''),NULLIF(btrim(alt->>'shop'),''),NULLIF(btrim(alt->>'image'),''),CASE WHEN COALESCE(btrim(alt->>'image'),'')='' THEN '[]'::jsonb ELSE jsonb_build_array(btrim(alt->>'image')) END,_price,gender_value,COALESCE(_details->>'color_family',original.color_family),COALESCE(_details->>'garment_type',original.garment_type),COALESCE(_details->>'silhouette',original.silhouette),btrim(_size),jsonb_build_array(jsonb_build_object('label',btrim(_size),'available',true)),NULLIF(_details->>'notes',''),original.boutique_id) RETURNING * INTO replacement;
  alt:=alt || jsonb_build_object('outfitId',replacement.id);
 END IF;
 rid:=public.save_outfit_substitution(_reservation_id,_order_id,alt,_size,_price,_expected);
 UPDATE public.outfits SET retired_at=COALESCE(retired_at,now()) WHERE id=original.id AND invite_id=r.invite_id;
 RETURN jsonb_build_object('reservationId',rid,'alternative',alt,'replacementOutfitId',replacement.id);
END $$;
REVOKE ALL ON FUNCTION public.save_collection_substitution(uuid,uuid,jsonb,text,numeric,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_collection_substitution(uuid,uuid,jsonb,text,numeric,timestamptz,jsonb) TO authenticated;