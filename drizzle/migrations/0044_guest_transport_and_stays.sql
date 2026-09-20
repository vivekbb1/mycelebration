CREATE TABLE IF NOT EXISTS public.guest_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  household text NOT NULL,
  guest_name text,
  kind text NOT NULL DEFAULT 'pickup',
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  driver_name text,
  driver_phone text,
  vehicle text,
  from_place text,
  to_place text,
  scheduled_at timestamptz,
  flight text,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_transport_household_idx ON public.guest_transport (household);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_transport TO authenticated;
GRANT ALL ON public.guest_transport TO service_role;

ALTER TABLE public.guest_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hosts manage transport" ON public.guest_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "guests read own transport" ON public.guest_transport FOR SELECT TO authenticated
  USING (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.guest_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE,
  household text NOT NULL,
  guest_name text,
  hotel_name text,
  hotel_address text,
  room_number text,
  room_type text,
  checkin_date date,
  checkout_date date,
  host_contact text,
  status text NOT NULL DEFAULT 'to assign',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_stays_household_idx ON public.guest_stays (household);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_stays TO authenticated;
GRANT ALL ON public.guest_stays TO service_role;

ALTER TABLE public.guest_stays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hosts manage stays" ON public.guest_stays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "guests read own stay" ON public.guest_stays FOR SELECT TO authenticated
  USING (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

CREATE TRIGGER guest_transport_touch BEFORE UPDATE ON public.guest_transport
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER guest_stays_touch BEFORE UPDATE ON public.guest_stays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();