ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS cover_logo_url text,
  ADD COLUMN IF NOT EXISTS cover_logo_height integer NOT NULL DEFAULT 96;