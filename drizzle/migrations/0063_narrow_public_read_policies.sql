DROP POLICY IF EXISTS "Anyone signed in can read plans" ON public.plans;
CREATE POLICY "Hosts can read plans" ON public.plans FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_platform_admin());

DROP POLICY IF EXISTS "Anyone signed in can see add-ons" ON public.addons;
CREATE POLICY "Hosts can read add-ons" ON public.addons FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_platform_admin());

DROP POLICY IF EXISTS "anyone can read branding" ON public.branding;
CREATE POLICY "anyone can read site branding" ON public.branding FOR SELECT TO anon, authenticated
USING (id = 'default');

DROP POLICY IF EXISTS "anyone can read site content" ON public.site_content;
CREATE POLICY "anyone can read page wording" ON public.site_content FOR SELECT TO anon, authenticated
USING (kind IN ('text', 'multiline'));