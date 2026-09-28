ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS default_travel_need text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS travel_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passport_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS travel_need text;
ALTER TABLE public.travel_plans
  ADD COLUMN IF NOT EXISTS checkin_date date,
  ADD COLUMN IF NOT EXISTS checkin_time text,
  ADD COLUMN IF NOT EXISTS checkout_date date,
  ADD COLUMN IF NOT EXISTS checkout_time text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.validate_travel_need() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'invites' THEN
    IF NEW.default_travel_need NOT IN ('none','stay','stay_transfer') THEN RAISE EXCEPTION 'Invalid travel need'; END IF;
  ELSE
    IF NEW.travel_need IS NOT NULL AND NEW.travel_need NOT IN ('none','stay','stay_transfer') THEN RAISE EXCEPTION 'Invalid travel need'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invites_travel_need_check ON public.invites;
CREATE TRIGGER invites_travel_need_check BEFORE INSERT OR UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.validate_travel_need();
DROP TRIGGER IF EXISTS families_travel_need_check ON public.families;
CREATE TRIGGER families_travel_need_check BEFORE INSERT OR UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.validate_travel_need();

CREATE OR REPLACE FUNCTION public.my_travel_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'need', COALESCE(f.travel_need, i.default_travel_need, 'none'),
    'travel_required', COALESCE(i.travel_required, false),
    'passport_required', COALESCE(i.passport_required, false))
  FROM public.invites i
  LEFT JOIN public.families f ON f.invite_id = i.id
    AND f.name = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  WHERE i.id IN (SELECT invite_id FROM public.my_guest_invite_ids())
  ORDER BY i.created_at LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.my_travel_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_travel_settings() TO authenticated;

CREATE TABLE IF NOT EXISTS public.family_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  household text NOT NULL,
  body text NOT NULL,
  author_id uuid DEFAULT auth.uid(),
  author_name text,
  is_change_log boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_notes TO authenticated;
GRANT ALL ON public.family_notes TO service_role;
ALTER TABLE public.family_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read notes" ON public.family_notes FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));
CREATE POLICY "Hosts add notes" ON public.family_notes FOR INSERT TO authenticated WITH CHECK (public.is_celebration_host(invite_id) AND author_id = auth.uid());
CREATE POLICY "Authors edit notes" ON public.family_notes FOR UPDATE TO authenticated USING (public.is_celebration_host(invite_id) AND author_id = auth.uid()) WITH CHECK (public.is_celebration_host(invite_id) AND author_id = auth.uid());
CREATE POLICY "Authors or owners delete notes" ON public.family_notes FOR DELETE TO authenticated USING (public.is_celebration_host(invite_id) AND (author_id = auth.uid() OR public.is_celebration_owner(invite_id)));
CREATE INDEX IF NOT EXISTS family_notes_household_idx ON public.family_notes(invite_id, household);
CREATE TRIGGER family_notes_updated_at BEFORE UPDATE ON public.family_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.log_host_travel_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text := ''; who text; col text; o text; n text;
  cols text[];
BEGIN
  IF auth.uid() IS NULL OR NEW.invite_id IS NULL OR NOT public.is_celebration_host(NEW.invite_id) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'travel_plans' THEN
    NEW.updated_by := auth.uid();
    cols := ARRAY['arrival_date','arrival_time','arrival_flight','departure_date','departure_time','departure_flight','checkin_date','checkin_time','checkout_date','checkout_time','party_size','notes'];
  ELSE
    NEW.updated_by := auth.uid();
    cols := ARRAY['first_name','last_name','date_of_birth','passport_number','nationality','expiry','doc_path'];
  END IF;
  FOREACH col IN ARRAY cols LOOP
    IF TG_OP = 'UPDATE' THEN o := to_jsonb(OLD) ->> col; ELSE o := NULL; END IF;
    n := to_jsonb(NEW) ->> col;
    IF o IS DISTINCT FROM n THEN
      msg := msg || replace(col, '_', ' ') || ': ' || COALESCE(o, '—') || ' → ' || COALESCE(n, '—') || E'\n';
    END IF;
  END LOOP;
  IF msg <> '' THEN
    SELECT full_name INTO who FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.family_notes(invite_id, household, body, author_id, author_name, is_change_log)
    VALUES (NEW.invite_id, NEW.household,
      CASE WHEN TG_TABLE_NAME = 'travel_plans' THEN 'Travel updated by host' ELSE 'Passport updated by host for ' || NEW.person_name END || E'\n' || msg,
      auth.uid(), who, true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS travel_plans_host_log ON public.travel_plans;
CREATE TRIGGER travel_plans_host_log BEFORE INSERT OR UPDATE ON public.travel_plans FOR EACH ROW EXECUTE FUNCTION public.log_host_travel_change();
DROP TRIGGER IF EXISTS guest_passports_host_log ON public.guest_passports;
CREATE TRIGGER guest_passports_host_log BEFORE INSERT OR UPDATE ON public.guest_passports FOR EACH ROW EXECUTE FUNCTION public.log_host_travel_change();