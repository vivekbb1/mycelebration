ALTER TABLE public.wardrobe_alterations ADD COLUMN IF NOT EXISTS photo_notes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.wardrobe_alterations ADD COLUMN IF NOT EXISTS workman text NOT NULL DEFAULT '';
ALTER TABLE public.wardrobe_alterations ADD COLUMN IF NOT EXISTS workman_phone text NOT NULL DEFAULT '';