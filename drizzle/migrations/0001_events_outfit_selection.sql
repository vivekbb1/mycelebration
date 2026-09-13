ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS outfit_selection boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.outfit_selection IS 'When false, guests wear their own clothes for this function and cannot pick from the lookbook.';