ALTER TABLE public.reservations ADD COLUMN member_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL;
ALTER TABLE public.measurements ADD COLUMN member_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL;
ALTER TABLE public.room_assignments ADD COLUMN member_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL;
ALTER TABLE public.guest_passports ADD COLUMN member_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL;
ALTER TABLE public.travel_plans ADD COLUMN traveller_code_ids uuid[];
CREATE INDEX ON public.reservations(member_code_id);
CREATE INDEX ON public.measurements(member_code_id);
CREATE INDEX ON public.room_assignments(member_code_id);
CREATE INDEX ON public.guest_passports(member_code_id);

-- Resolve the wearer's code from the reserving account + wearer name.
CREATE OR REPLACE FUNCTION public.resolve_member_code(_account uuid, _invite uuid, _name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT household, id FROM invite_codes WHERE claimed_by = _account AND invite_id = _invite LIMIT 1)
  SELECT COALESCE(
    (SELECT c.id FROM invite_codes c, me WHERE c.invite_id = _invite AND c.household = me.household
       AND nullif(trim(_name),'') IS NOT NULL AND lower(trim(c.guest_name)) = lower(trim(_name)) LIMIT 1),
    CASE WHEN nullif(trim(_name),'') IS NULL THEN (SELECT id FROM me) END)
$$;
REVOKE ALL ON FUNCTION public.resolve_member_code(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fill_member_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.member_code_id IS NULL THEN
    NEW.member_code_id := public.resolve_member_code(NEW.guest_id, NEW.invite_id, NEW.guest_name);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fill_member_code() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reservations_fill_member_code BEFORE INSERT ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.fill_member_code();
CREATE TRIGGER measurements_fill_member_code BEFORE INSERT ON public.measurements FOR EACH ROW EXECUTE FUNCTION public.fill_member_code();

UPDATE public.reservations SET member_code_id = public.resolve_member_code(guest_id, invite_id, guest_name) WHERE member_code_id IS NULL;
UPDATE public.measurements SET member_code_id = public.resolve_member_code(guest_id, invite_id, guest_name) WHERE member_code_id IS NULL;
UPDATE public.room_assignments r SET member_code_id = c.id FROM public.invite_codes c
  WHERE r.member_code_id IS NULL AND c.invite_id = r.invite_id AND c.household = r.household AND lower(trim(c.guest_name)) = lower(trim(r.guest_name));
UPDATE public.guest_passports p SET member_code_id = c.id FROM public.invite_codes c
  WHERE p.member_code_id IS NULL AND c.invite_id = p.invite_id AND c.household = p.household AND lower(trim(c.guest_name)) = lower(trim(p.person_name));
UPDATE public.travel_plans t SET traveller_code_ids = ARRAY(
  SELECT c.id FROM public.invite_codes c, unnest(t.travellers) n
  WHERE c.invite_id = t.invite_id AND c.household = t.household AND lower(trim(c.guest_name)) = lower(trim(n)))
  WHERE t.travellers IS NOT NULL AND array_length(t.travellers,1) > 0;