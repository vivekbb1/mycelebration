-- Invitation planning data and saved themes are host-only tools; restrict reads to admins.
DROP POLICY IF EXISTS "Signed in users can read invites" ON public.invites;
CREATE POLICY "Admins read invites" ON public.invites
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'branding_presets' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.branding_presets', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins read branding presets" ON public.branding_presets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.branding_presets FROM anon;
REVOKE SELECT ON public.invites FROM anon;