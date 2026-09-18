ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'family';

CREATE INDEX IF NOT EXISTS invite_codes_category_idx ON public.invite_codes (category);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;