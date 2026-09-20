-- Guests should only read the events, outfits and delivery details of the celebration they belong to.
DROP POLICY IF EXISTS "guests read events" ON public.events;
CREATE POLICY "guests read their own events" ON public.events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR id IN (SELECT event_id FROM public.my_event_ids())
  OR EXISTS (SELECT 1 FROM public.boutique_members bm WHERE bm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "guests read outfits" ON public.outfits;
CREATE POLICY "guests read their own outfits" ON public.outfits
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR event_id IS NULL
  OR event_id IN (SELECT event_id FROM public.my_event_ids())
  OR (boutique_id IS NOT NULL AND public.is_boutique_member(boutique_id))
);

DROP POLICY IF EXISTS "guests read logistics" ON public.logistics;
CREATE POLICY "invited guests read logistics" ON public.logistics
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.my_event_ids())
  OR EXISTS (SELECT 1 FROM public.boutique_members bm WHERE bm.user_id = auth.uid())
);