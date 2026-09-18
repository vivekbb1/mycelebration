CREATE TABLE IF NOT EXISTS public.event_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'guest',
  label text NOT NULL DEFAULT 'Event fee',
  currency text NOT NULL DEFAULT 'INR',
  base_amount numeric NOT NULL DEFAULT 0,
  per_guest_amount numeric NOT NULL DEFAULT 0,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_fees_invite_idx ON public.event_fees (invite_id);
CREATE INDEX IF NOT EXISTS event_fees_event_idx ON public.event_fees (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_fees TO authenticated;
GRANT ALL ON public.event_fees TO service_role;

ALTER TABLE public.event_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage event fees"
  ON public.event_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Guests see the fees for their own event"
  ON public.event_fees FOR SELECT TO authenticated
  USING (
    audience = 'guest'
    AND active
    AND (
      event_id IS NULL
      OR event_id IN (SELECT event_id FROM public.my_event_ids())
    )
  );

CREATE TRIGGER event_fees_updated_at BEFORE UPDATE ON public.event_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE CASCADE,
  payer_kind text NOT NULL DEFAULT 'guest',
  household text,
  host_id uuid,
  currency text NOT NULL DEFAULT 'INR',
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  method text,
  note text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fee_payments_invite_idx ON public.fee_payments (invite_id);
CREATE INDEX IF NOT EXISTS fee_payments_household_idx ON public.fee_payments (household);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage fee payments"
  ON public.fee_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Guests see their own household payments"
  ON public.fee_payments FOR SELECT TO authenticated
  USING (
    payer_kind = 'guest'
    AND household IS NOT NULL
    AND household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE TRIGGER fee_payments_updated_at BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
