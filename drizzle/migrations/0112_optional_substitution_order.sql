CREATE OR REPLACE FUNCTION public.save_outfit_substitution(_reservation_id uuid,_order_id uuid DEFAULT NULL,_alternative jsonb DEFAULT NULL,_size text DEFAULT NULL,_price numeric DEFAULT NULL,_expected timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reservations; o public.wardrobe_orders; pre public.wardrobe_preorder_alternatives; previous_snapshot jsonb; next_items jsonb;
BEGIN
 SELECT * INTO r FROM public.reservations WHERE id=_reservation_id FOR UPDATE;
 IF r.id IS NULL OR NOT public.is_celebration_host(r.invite_id) THEN RAISE EXCEPTION 'Only celebration hosts can substitute outfits'; END IF;
 IF jsonb_typeof(_alternative) IS DISTINCT FROM 'object' OR COALESCE(btrim(_alternative->>'title'),'')='' OR COALESCE(btrim(_size),'')='' OR _price IS NULL OR _price<0 THEN RAISE EXCEPTION 'Enter an outfit name, replacement size and valid price'; END IF;
 IF COALESCE(_alternative->>'outfitId','')<>'' AND NOT EXISTS(SELECT 1 FROM public.outfits WHERE id=(_alternative->>'outfitId')::uuid AND invite_id=r.invite_id) THEN RAISE EXCEPTION 'Alternative must belong to this celebration'; END IF;
 IF _order_id IS NOT NULL THEN
  SELECT * INTO o FROM public.wardrobe_orders WHERE id=_order_id AND invite_id=r.invite_id FOR UPDATE;
  IF o.id IS NULL OR o.status='cancelled' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.items) i WHERE i->>'reservationId'=r.id::text) THEN RAISE EXCEPTION 'Reopen the order; this look is no longer active'; END IF;
  IF _expected IS NOT NULL AND o.updated_at IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Order changed; reopen it before substituting'; END IF;
  SELECT jsonb_agg(CASE WHEN i->>'reservationId'=r.id::text THEN i || jsonb_build_object('alternative',_alternative,'orderedSize',btrim(_size),'price',_price) ELSE i END ORDER BY ord) INTO next_items FROM jsonb_array_elements(o.items) WITH ORDINALITY x(i,ord);
  UPDATE public.wardrobe_orders SET items=next_items WHERE id=o.id;
 ELSE
  IF r.order_placed_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.wardrobe_orders w,jsonb_array_elements(w.items) i WHERE w.invite_id=r.invite_id AND w.status<>'cancelled' AND i->>'reservationId'=r.id::text) THEN RAISE EXCEPTION 'This look is in an order; substitute from that order'; END IF;
  SELECT * INTO pre FROM public.wardrobe_preorder_alternatives WHERE reservation_id=r.id;
  IF _expected IS DISTINCT FROM pre.updated_at THEN RAISE EXCEPTION 'Pre-order changed; reopen it before substituting'; END IF;
  IF pre.reservation_id IS NULL THEN
   SELECT jsonb_build_object('title',title,'sku',COALESCE(source_sku,''),'designer',COALESCE(designer,''),'image',COALESCE(image_url,''),'size',COALESCE(r.size_choice,r.build_size,'')) INTO previous_snapshot FROM public.outfits WHERE id=r.outfit_id;
  ELSE previous_snapshot:=pre.alternative || jsonb_build_object('size',pre.ordered_size); END IF;
  INSERT INTO public.wardrobe_preorder_alternatives(reservation_id,invite_id,alternative,ordered_size,revised_price) VALUES(r.id,r.invite_id,_alternative,btrim(_size),_price) ON CONFLICT(reservation_id) DO UPDATE SET alternative=excluded.alternative,ordered_size=excluded.ordered_size,revised_price=excluded.revised_price,updated_at=now();
  IF previous_snapshot IS DISTINCT FROM (_alternative || jsonb_build_object('size',btrim(_size))) THEN PERFORM public.record_outfit_substitution(r.id,NULL,previous_snapshot,_alternative || jsonb_build_object('size',btrim(_size))); END IF;
 END IF;
 RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.save_outfit_substitution(uuid,uuid,jsonb,text,numeric,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_outfit_substitution(uuid,uuid,jsonb,text,numeric,timestamptz) TO authenticated;