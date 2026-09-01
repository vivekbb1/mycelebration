-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'guest');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  city text,
  country text,
  whatsapp text,
  invite_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'guest')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  dress_code text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- outfits
CREATE TABLE public.outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  designer text,
  boutique_url text,
  image_url text,
  color_family text,
  gender text NOT NULL DEFAULT 'women',
  garment_type text,
  size_note text,
  price_note text,
  notes text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfits TO authenticated;
GRANT ALL ON public.outfits TO service_role;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests read outfits" ON public.outfits FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage outfits" ON public.outfits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER outfits_updated_at BEFORE UPDATE ON public.outfits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- reservations: one guest per outfit
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL UNIQUE REFERENCES public.outfits(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  guest_name text,
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests read reservations" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "guests create own reservation" ON public.reservations FOR INSERT TO authenticated WITH CHECK (guest_id = auth.uid());
CREATE POLICY "guests update own reservation" ON public.reservations FOR UPDATE TO authenticated USING (guest_id = auth.uid()) WITH CHECK (guest_id = auth.uid());
CREATE POLICY "guests delete own reservation" ON public.reservations FOR DELETE TO authenticated USING (guest_id = auth.uid());
CREATE POLICY "admins manage reservations" ON public.reservations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- measurements
CREATE TABLE public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'cm',
  height numeric,
  bust numeric,
  waist numeric,
  hip numeric,
  shoulder numeric,
  sleeve_length numeric,
  top_length numeric,
  bottom_length numeric,
  inseam numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurements TO authenticated;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own measurements" ON public.measurements FOR ALL TO authenticated USING (guest_id = auth.uid()) WITH CHECK (guest_id = auth.uid());
CREATE POLICY "admins read measurements" ON public.measurements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER measurements_updated_at BEFORE UPDATE ON public.measurements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- invite codes
CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  guest_name text NOT NULL,
  email text,
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage invites" ON public.invite_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read own claimed invite" ON public.invite_codes FOR SELECT TO authenticated USING (claimed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invite_codes;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;

  SELECT * INTO inv FROM public.invite_codes
  WHERE upper(trim(code)) = upper(trim(_code)) LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That invitation code was not recognised');
  END IF;

  IF inv.claimed_by IS NOT NULL AND inv.claimed_by <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That invitation has already been used');
  END IF;

  UPDATE public.invite_codes
  SET claimed_by = auth.uid(), claimed_at = COALESCE(claimed_at, now())
  WHERE id = inv.id;

  UPDATE public.profiles
  SET invite_claimed = true,
      full_name = CASE WHEN coalesce(full_name, '') = '' THEN inv.guest_name ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO authenticated;

-- first guest-facing functions seeded
INSERT INTO public.events (name, event_date, dress_code, sort_order) VALUES
  ('Mehndi', '2026-12-11', 'Bright yellows, greens and mirror work. Light and comfortable.', 1),
  ('Sangeet', '2026-12-12', 'Full-on glamour: sequins, metallics, dancing-friendly.', 2),
  ('Wedding Ceremony', '2026-12-13', 'Traditional silks and heavy embroidery. Avoid red and ivory.', 3),
  ('Reception', '2026-12-13', 'Black-tie Indian: gowns, sherwanis, indo-western.', 4);
