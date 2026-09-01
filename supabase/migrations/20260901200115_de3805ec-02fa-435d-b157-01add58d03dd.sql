-- Boutiques / tailors
CREATE TABLE public.boutiques (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  access_code text NOT NULL UNIQUE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boutiques TO authenticated;
GRANT ALL ON public.boutiques TO service_role;

ALTER TABLE public.boutiques ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER boutiques_updated_at BEFORE UPDATE ON public.boutiques
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Boutique staff membership
CREATE TABLE public.boutique_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boutique_id uuid NOT NULL REFERENCES public.boutiques(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (boutique_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boutique_members TO authenticated;
GRANT ALL ON public.boutique_members TO service_role;

ALTER TABLE public.boutique_members ENABLE ROW LEVEL SECURITY;

-- Outfits belong to a boutique
ALTER TABLE public.outfits
  ADD COLUMN boutique_id uuid REFERENCES public.boutiques(id) ON DELETE SET NULL;

-- Helper functions (scoped to the caller only)
CREATE OR REPLACE FUNCTION public.is_boutique_member(_boutique_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boutique_members
    WHERE boutique_id = _boutique_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_boutique_see_outfit(_outfit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.outfits o
    JOIN public.boutique_members m ON m.boutique_id = o.boutique_id
    WHERE o.id = _outfit_id AND m.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_boutique_see_guest(_guest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservations r
    JOIN public.outfits o ON o.id = r.outfit_id
    JOIN public.boutique_members m ON m.boutique_id = o.boutique_id
    WHERE r.guest_id = _guest_id AND m.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_boutique_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_boutique_see_outfit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_boutique_see_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_boutique_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_boutique_see_outfit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_boutique_see_guest(uuid) TO authenticated, service_role;

-- Policies: boutiques
CREATE POLICY "admins manage boutiques" ON public.boutiques
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "stylists read own boutique" ON public.boutiques
FOR SELECT TO authenticated
USING (public.is_boutique_member(id));

-- Policies: boutique_members
CREATE POLICY "admins manage boutique members" ON public.boutique_members
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "stylists read own membership" ON public.boutique_members
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Policies: orders visible to the boutique that supplies the outfit
CREATE POLICY "boutiques read their orders" ON public.reservations
FOR SELECT TO authenticated
USING (public.can_boutique_see_outfit(outfit_id));

CREATE POLICY "boutiques read measurements for their orders" ON public.measurements
FOR SELECT TO authenticated
USING (public.can_boutique_see_guest(guest_id));