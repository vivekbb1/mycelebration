CREATE TABLE public.email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  recipient text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT ALL ON public.email_delivery_events TO service_role;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read delivery events" ON public.email_delivery_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX email_delivery_events_recipient_idx ON public.email_delivery_events (lower(recipient));