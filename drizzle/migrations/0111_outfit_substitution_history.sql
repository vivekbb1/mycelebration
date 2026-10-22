CREATE TABLE public.wardrobe_preorder_alternatives (
 reservation_id uuid PRIMARY KEY REFERENCES public.reservations(id) ON DELETE CASCADE,
 invite_id uuid NOT NULL REFERENCES public.invites(id),
 alternative jsonb NOT NULL,
 ordered_size text NOT NULL DEFAULT '',
 revised_price numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wardrobe_preorder_alternatives TO authenticated;
GRANT ALL ON public.wardrobe_preorder_alternatives TO service_role;
ALTER TABLE public.wardrobe_preorder_alternatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY host_read ON public.wardrobe_preorder_alternatives FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));
CREATE TABLE public.wardrobe_substitution_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invite_id uuid NOT NULL REFERENCES public.invites(id),
 reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
 order_id uuid REFERENCES public.wardrobe_orders(id) ON DELETE SET NULL,
 original jsonb NOT NULL,
 previous jsonb NOT NULL,
 replacement jsonb NOT NULL,
 changed_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wardrobe_substitution_history TO authenticated;
GRANT ALL ON public.wardrobe_substitution_history TO service_role;
ALTER TABLE public.wardrobe_substitution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY host_read ON public.wardrobe_substitution_history FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));
CREATE INDEX wardrobe_substitution_history_reservation ON public.wardrobe_substitution_history(reservation_id,created_at DESC);
CREATE FUNCTION public.record_outfit_substitution(_rid uuid,_order uuid,_previous jsonb,_replacement jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.reservations; original_snapshot jsonb;
BEGIN
 SELECT * INTO r FROM public.reservations WHERE id=_rid;
 IF r.id IS NULL OR (NOT public.is_celebration_host(r.invite_id) AND COALESCE(auth.role(),'')<>'service_role') THEN RAISE EXCEPTION 'Only celebration hosts can substitute outfits'; END IF;
 SELECT original INTO original_snapshot FROM public.wardrobe_substitution_history WHERE reservation_id=_rid ORDER BY created_at LIMIT 1;
 IF original_snapshot IS NULL THEN
  SELECT jsonb_build_object('title',o.title,'sku',COALESCE(o.source_sku,''),'designer',COALESCE(o.designer,''),'image',COALESCE(o.image_url,''),'size',COALESCE(r.size_choice,r.build_size,''),'wearer',COALESCE(c.guest_name,r.guest_name,'Guest'),'event',COALESCE(e.name,'')) INTO original_snapshot
  FROM public.outfits o LEFT JOIN public.events e ON e.id=o.event_id LEFT JOIN public.invite_codes c ON c.id=r.member_code_id WHERE o.id=r.outfit_id;
 END IF;
 INSERT INTO public.wardrobe_substitution_history(invite_id,reservation_id,order_id,original,previous,replacement) VALUES(r.invite_id,_rid,_order,original_snapshot,_previous,_replacement);
END $$;
REVOKE ALL ON FUNCTION public.record_outfit_substitution(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.audit_order_substitutions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i jsonb; prior jsonb; pre public.wardrobe_preorder_alternatives; before_snapshot jsonb; after_snapshot jsonb;
BEGIN
 FOR i IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
  prior:=NULL;
  IF TG_OP='UPDATE' THEN SELECT x INTO prior FROM jsonb_array_elements(OLD.items) x WHERE x->>'reservationId'=i->>'reservationId'; END IF;
  IF prior IS NULL THEN
   SELECT * INTO pre FROM public.wardrobe_preorder_alternatives WHERE reservation_id=(i->>'reservationId')::uuid;
   IF pre.reservation_id IS NOT NULL THEN prior:=i || jsonb_build_object('alternative',pre.alternative,'orderedSize',pre.ordered_size); END IF;
  END IF;
  before_snapshot:=COALESCE(NULLIF(prior->'alternative','null'::jsonb),jsonb_build_object('title',i->>'title','sku',i->>'sku','designer',i->>'designer','image',i->>'image')) || jsonb_build_object('size',COALESCE(prior->>'orderedSize',i->>'size',''));
  after_snapshot:=COALESCE(NULLIF(i->'alternative','null'::jsonb),jsonb_build_object('title',i->>'title','sku',i->>'sku','designer',i->>'designer','image',i->>'image')) || jsonb_build_object('size',COALESCE(i->>'orderedSize',i->>'size',''));
  IF before_snapshot IS DISTINCT FROM after_snapshot AND (prior IS NOT NULL OR NULLIF(i->'alternative','null'::jsonb) IS NOT NULL) THEN
   PERFORM public.record_outfit_substitution((i->>'reservationId')::uuid,NEW.id,before_snapshot,after_snapshot);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_order_substitutions() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wardrobe_orders_audit_substitutions AFTER INSERT OR UPDATE ON public.wardrobe_orders FOR EACH ROW EXECUTE FUNCTION public.audit_order_substitutions();
CREATE FUNCTION public.save_outfit_substitution(_reservation_id uuid,_order_id uuid,_alternative jsonb,_size text,_price numeric,_expected timestamptz DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
