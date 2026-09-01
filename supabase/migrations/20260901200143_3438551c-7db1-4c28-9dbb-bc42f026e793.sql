CREATE OR REPLACE FUNCTION public.is_boutique_member(_boutique_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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
SECURITY INVOKER
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
SECURITY INVOKER
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