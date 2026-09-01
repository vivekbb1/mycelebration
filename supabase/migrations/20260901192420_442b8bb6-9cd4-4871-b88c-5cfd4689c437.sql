-- 1) Stop signed-in clients from executing SECURITY DEFINER functions directly.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_host_access() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_host_access() TO service_role;

-- 2) Guests must no longer read other guests' identities.
DROP POLICY IF EXISTS "guests read reservations" ON public.reservations;

CREATE POLICY "guests read own reservations"
ON public.reservations FOR SELECT TO authenticated
USING (guest_id = auth.uid());

-- Availability is exposed through outfits.is_available instead of reservation rows.
CREATE OR REPLACE FUNCTION public.sync_outfit_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.outfits o
    SET is_available = NOT EXISTS (
      SELECT 1 FROM public.reservations r WHERE r.outfit_id = o.id
    )
    WHERE o.id = OLD.outfit_id;
    RETURN OLD;
  END IF;

  UPDATE public.outfits SET is_available = false WHERE id = NEW.outfit_id;

  IF (TG_OP = 'UPDATE' AND OLD.outfit_id <> NEW.outfit_id) THEN
    UPDATE public.outfits o
    SET is_available = NOT EXISTS (
      SELECT 1 FROM public.reservations r WHERE r.outfit_id = o.id
    )
    WHERE o.id = OLD.outfit_id;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.sync_outfit_availability() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reservations_sync_availability ON public.reservations;
CREATE TRIGGER reservations_sync_availability
AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.sync_outfit_availability();

-- Backfill current availability.
UPDATE public.outfits o
SET is_available = NOT EXISTS (
  SELECT 1 FROM public.reservations r WHERE r.outfit_id = o.id
);