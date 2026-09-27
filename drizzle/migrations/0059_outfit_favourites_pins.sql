ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
CREATE TABLE public.outfit_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, outfit_id)
);
GRANT SELECT, INSERT, DELETE ON public.outfit_favourites TO authenticated;
GRANT ALL ON public.outfit_favourites TO service_role;
ALTER TABLE public.outfit_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favourites" ON public.outfit_favourites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Hosts read favourites" ON public.outfit_favourites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));