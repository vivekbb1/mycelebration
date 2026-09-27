CREATE OR REPLACE FUNCTION public.claim_host_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'Host access needs a host invitation');
END; $function$;

REVOKE EXECUTE ON FUNCTION public.claim_host_access() FROM anon, public;

DROP POLICY IF EXISTS "Hosts manage budget items" ON public.budget_items;
CREATE POLICY "Hosts manage budget items" ON public.budget_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND (public.my_features() ? 'budgeting' OR public.my_features() ? 'all'))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND (public.my_features() ? 'budgeting' OR public.my_features() ? 'all'));

DROP POLICY IF EXISTS "Hosts manage vendors" ON public.vendors;
CREATE POLICY "Hosts manage vendors" ON public.vendors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND (public.my_features() ? 'vendor_management' OR public.my_features() ? 'all'))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND (public.my_features() ? 'vendor_management' OR public.my_features() ? 'all'));