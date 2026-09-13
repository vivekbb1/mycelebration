ALTER TABLE public.outfits
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_sku text,
  ADD COLUMN IF NOT EXISTS silhouette text,
  ADD COLUMN IF NOT EXISTS price_inr numeric;

CREATE UNIQUE INDEX IF NOT EXISTS outfits_source_sku_key
  ON public.outfits (source_sku)
  WHERE source_sku IS NOT NULL;