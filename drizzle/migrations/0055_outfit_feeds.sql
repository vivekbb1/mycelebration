CREATE TABLE public.outfit_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'women' CHECK (audience IN ('women','men','kids')),
  label text,
  category text NOT NULL,
  min_price integer NOT NULL DEFAULT 0,
  max_price integer NOT NULL DEFAULT 30000,
  colour text,
  ready_to_ship boolean NOT NULL DEFAULT false,
  ship_in_days text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.outfit_feed_hidden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfit_feeds TO authenticated;
GRANT ALL ON public.outfit_feeds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfit_feed_hidden TO authenticated;
GRANT ALL ON public.outfit_feed_hidden TO service_role;
ALTER TABLE public.outfit_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_feed_hidden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage feeds" ON public.outfit_feeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Hosts manage hidden looks" ON public.outfit_feed_hidden FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));