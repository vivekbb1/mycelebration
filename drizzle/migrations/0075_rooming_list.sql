CREATE TABLE public.hotel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Standard',
  floor text,
  room_number text NOT NULL,
  beds integer NOT NULL DEFAULT 2,
  max_occupancy integer NOT NULL DEFAULT 2,
  extra_bed_allowed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, room_number)
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_rooms TO authenticated;
--> statement-breakpoint
GRANT ALL ON public.hotel_rooms TO service_role;
--> statement-breakpoint
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Hosts manage rooms" ON public.hotel_rooms FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'arrivals'))
  WITH CHECK (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'arrivals'));
--> statement-breakpoint
CREATE TRIGGER hotel_rooms_updated BEFORE UPDATE ON public.hotel_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TABLE public.room_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.hotel_rooms(id) ON DELETE CASCADE,
  household text NOT NULL,
  guest_name text NOT NULL,
  extra_bed boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, household, guest_name)
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_assignments TO authenticated;
--> statement-breakpoint
GRANT ALL ON public.room_assignments TO service_role;
--> statement-breakpoint
ALTER TABLE public.room_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Hosts manage room assignments" ON public.room_assignments FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'arrivals'))
  WITH CHECK (public.is_celebration_host(invite_id) AND public.celebration_has_feature(invite_id, 'arrivals'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.check_room_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  r public.hotel_rooms;
  n integer;
BEGIN
  SELECT * INTO r FROM public.hotel_rooms WHERE id = NEW.room_id;
  IF r.invite_id <> NEW.invite_id THEN
    RAISE EXCEPTION 'Room belongs to another celebration';
  END IF;
  SELECT count(*) INTO n FROM public.room_assignments WHERE room_id = NEW.room_id AND id <> NEW.id;
  IF n + 1 > r.max_occupancy + (CASE WHEN r.extra_bed_allowed THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION 'Room % is full', r.room_number;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
CREATE TRIGGER room_assignments_capacity BEFORE INSERT OR UPDATE ON public.room_assignments
  FOR EACH ROW EXECUTE FUNCTION public.check_room_capacity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.my_room()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
    'hotel', v.name, 'address', v.city, 'room_number', r.room_number,
    'category', r.category, 'floor', r.floor)), '[]'::jsonb)
  FROM public.room_assignments a
  JOIN public.hotel_rooms r ON r.id = a.room_id
  JOIN public.vendors v ON v.id = r.vendor_id
  WHERE public.is_my_household(a.household, a.invite_id)
$fn$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.my_room() FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.my_room() TO authenticated;