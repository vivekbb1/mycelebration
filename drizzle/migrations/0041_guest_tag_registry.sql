CREATE TABLE IF NOT EXISTS public.guest_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_tags_invite_name_idx
  ON public.guest_tags (COALESCE(invite_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_tags TO authenticated;
GRANT ALL ON public.guest_tags TO service_role;

ALTER TABLE public.guest_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage guest tags" ON public.guest_tags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER guest_tags_updated_at
  BEFORE UPDATE ON public.guest_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();