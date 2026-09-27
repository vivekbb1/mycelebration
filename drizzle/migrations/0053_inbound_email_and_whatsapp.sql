ALTER TABLE public.guest_messages ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'app';
ALTER TABLE public.guest_messages ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.guest_messages ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS guest_messages_external_id_idx ON public.guest_messages(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.inbound_unmatched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  sender text NOT NULL,
  sender_name text,
  subject text,
  body text NOT NULL,
  external_id text UNIQUE,
  household text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.inbound_unmatched TO authenticated;
GRANT ALL ON public.inbound_unmatched TO service_role;
ALTER TABLE public.inbound_unmatched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage unmatched inbound" ON public.inbound_unmatched FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.whatsapp_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid,
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.whatsapp_broadcasts TO authenticated;
GRANT ALL ON public.whatsapp_broadcasts TO service_role;
ALTER TABLE public.whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read broadcasts" ON public.whatsapp_broadcasts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Hosts log broadcasts" ON public.whatsapp_broadcasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));