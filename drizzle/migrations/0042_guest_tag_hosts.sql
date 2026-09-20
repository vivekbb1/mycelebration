CREATE TABLE IF NOT EXISTS public.guest_tag_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.guest_tags(id) ON DELETE CASCADE,
  host_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_tag_hosts_unique_idx
  ON public.guest_tag_hosts (tag_id, host_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_tag_hosts TO authenticated;
GRANT ALL ON public.guest_tag_hosts TO service_role;

ALTER TABLE public.guest_tag_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage tag hosts" ON public.guest_tag_hosts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));