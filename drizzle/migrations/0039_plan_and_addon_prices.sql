ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_amount numeric,
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS price_period text NOT NULL DEFAULT 'one_off';

ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS price_amount numeric,
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS price_period text NOT NULL DEFAULT 'one_off';