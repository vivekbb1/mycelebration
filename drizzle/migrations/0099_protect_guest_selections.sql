CREATE TABLE public.reservation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  invite_id uuid,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reservation_history TO authenticated;
GRANT ALL ON public.reservation_history TO service_role;
ALTER TABLE public.reservation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read selection history" ON public.reservation_history
  FOR SELECT TO authenticated USING (public.is_celebration_host(invite_id));

CREATE OR REPLACE FUNCTION public.log_reservation_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO reservation_history(reservation_id, invite_id, action, old_row) VALUES (OLD.id, OLD.invite_id, 'released', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.outfit_id IS DISTINCT FROM NEW.outfit_id OR OLD.guest_name IS DISTINCT FROM NEW.guest_name OR OLD.guest_id IS DISTINCT FROM NEW.guest_id THEN
      INSERT INTO reservation_history(reservation_id, invite_id, action, old_row, new_row) VALUES (NEW.id, NEW.invite_id, 'changed', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO reservation_history(reservation_id, invite_id, action, new_row) VALUES (NEW.id, NEW.invite_id, 'reserved', to_jsonb(NEW));
    RETURN NEW;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.log_reservation_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reservations_history AFTER INSERT OR UPDATE OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.log_reservation_change();

-- A reserved look can never be deleted or moved to another event silently.
ALTER TABLE public.reservations DROP CONSTRAINT reservations_outfit_id_fkey,
  ADD CONSTRAINT reservations_outfit_id_fkey FOREIGN KEY (outfit_id) REFERENCES public.outfits(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_reserved_outfit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.event_id IS DISTINCT FROM NEW.event_id AND EXISTS (SELECT 1 FROM reservations WHERE outfit_id = OLD.id) THEN
    RAISE EXCEPTION 'This look has been chosen by a guest, so it cannot be moved to another event. Release the guest''s choice first.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_reserved_outfit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER outfits_guard_reserved BEFORE UPDATE OF event_id ON public.outfits
FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_outfit();