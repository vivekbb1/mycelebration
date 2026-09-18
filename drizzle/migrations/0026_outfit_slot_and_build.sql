ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS outfit_ready_by date,
  ADD COLUMN IF NOT EXISTS outfit_slot_note text;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS build_garment text,
  ADD COLUMN IF NOT EXISTS build_size text,
  ADD COLUMN IF NOT EXISTS build_fabric text;