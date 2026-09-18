ALTER TABLE public.logistics
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;