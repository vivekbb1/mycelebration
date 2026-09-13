ALTER TABLE public.reservations
  ADD COLUMN order_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_order_status_check
  CHECK (order_status IN ('pending', 'in_progress', 'ready', 'picked_up'));

ALTER TABLE public.reservations
  ADD COLUMN order_status_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS reservations_order_status_idx
  ON public.reservations (order_status);

-- Stylists may move their own atelier's orders along, nothing else.
CREATE POLICY "boutiques update their orders"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (public.can_boutique_see_outfit(outfit_id))
  WITH CHECK (public.can_boutique_see_outfit(outfit_id));