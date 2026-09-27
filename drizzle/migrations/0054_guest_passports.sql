CREATE OR REPLACE FUNCTION public.my_household() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(trim(household), '') FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_household() TO authenticated;

CREATE TABLE public.guest_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household text NOT NULL,
  person_name text NOT NULL,
  passport_number text,
  nationality text,
  expiry date,
  doc_path text,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household, person_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_passports TO authenticated;
GRANT ALL ON public.guest_passports TO service_role;
ALTER TABLE public.guest_passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guests manage own family passports" ON public.guest_passports FOR ALL TO authenticated
  USING (household = public.my_household()) WITH CHECK (household = public.my_household());
CREATE POLICY "Hosts manage passports" ON public.guest_passports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER guest_passports_updated BEFORE UPDATE ON public.guest_passports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Passports insert own family" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'passports' AND (storage.foldername(name))[1] = public.my_household());
CREATE POLICY "Passports read own family or host" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'passports' AND ((storage.foldername(name))[1] = public.my_household() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Passports update own family" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'passports' AND (storage.foldername(name))[1] = public.my_household());
CREATE POLICY "Passports delete own family or host" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'passports' AND ((storage.foldername(name))[1] = public.my_household() OR public.has_role(auth.uid(), 'admin')));