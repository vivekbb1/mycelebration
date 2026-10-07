ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS chest numeric,
  ADD COLUMN IF NOT EXISTS under_bust numeric,
  ADD COLUMN IF NOT EXISTS armhole numeric,
  ADD COLUMN IF NOT EXISTS neck numeric,
  ADD COLUMN IF NOT EXISTS usual_size text,
  ADD COLUMN IF NOT EXISTS form text;
ALTER TABLE public.measurements ADD CONSTRAINT measurements_form_check CHECK (form IS NULL OR form IN ('women','men'));
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS size_choice text;
ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS sizes jsonb;
COMMENT ON COLUMN public.outfits.sizes IS 'Shop sizes: [{label, available, ready_to_ship, ships_by}]';