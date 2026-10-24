CREATE TABLE public.invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  reference text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_drafts TO authenticated;
GRANT ALL ON public.invoice_drafts TO service_role;
ALTER TABLE public.invoice_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage invoice drafts" ON public.invoice_drafts FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id)) WITH CHECK (public.is_celebration_host(invite_id));
CREATE TRIGGER invoice_drafts_updated BEFORE UPDATE ON public.invoice_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();