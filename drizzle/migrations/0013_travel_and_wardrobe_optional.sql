-- Families can be RSVP-only (no wardrobe step)
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS needs_wardrobe BOOLEAN NOT NULL DEFAULT TRUE;

-- Travel plans: one row per family (guest_name NULL) or per person
CREATE TABLE IF NOT EXISTS public.travel_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household TEXT NOT NULL,
  guest_name TEXT,
  party_size INTEGER,
  arrival_date DATE,
  arrival_time TEXT,
  arrival_flight TEXT,
  departure_date DATE,
  departure_time TEXT,
  departure_flight TEXT,
  notes TEXT,
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS travel_plans_household_person_idx
  ON public.travel_plans (household, COALESCE(guest_name, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_plans TO authenticated;
GRANT ALL ON public.travel_plans TO service_role;
ALTER TABLE public.travel_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage travel plans" ON public.travel_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "guests manage own household travel" ON public.travel_plans FOR ALL TO authenticated
  USING (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER travel_plans_updated_at BEFORE UPDATE ON public.travel_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-function attendance confirmation with a head count
CREATE TABLE IF NOT EXISTS public.event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attending BOOLEAN NOT NULL DEFAULT TRUE,
  guest_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendance TO authenticated;
GRANT ALL ON public.event_attendance TO service_role;
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage event attendance" ON public.event_attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "guests manage own household attendance" ON public.event_attendance FOR ALL TO authenticated
  USING (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER event_attendance_updated_at BEFORE UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Guests need to know whether their own family requires the wardrobe step
CREATE OR REPLACE FUNCTION public.my_family_needs_wardrobe()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT f.needs_wardrobe FROM public.families f
      WHERE f.name = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
      LIMIT 1),
    TRUE)
$$;

GRANT EXECUTE ON FUNCTION public.my_family_needs_wardrobe() TO authenticated;