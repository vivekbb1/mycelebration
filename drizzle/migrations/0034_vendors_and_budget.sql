CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  city text,
  status text NOT NULL DEFAULT 'shortlisted',
  agreed_amount numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendors_invite_idx ON public.vendors (invite_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage vendors"
  ON public.vendors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  currency text NOT NULL DEFAULT 'INR',
  planned_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric,
  paid_amount numeric NOT NULL DEFAULT 0,
  due_on date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_items_invite_idx ON public.budget_items (invite_id);
CREATE INDEX IF NOT EXISTS budget_items_event_idx ON public.budget_items (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage budget items"
  ON public.budget_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER budget_items_updated_at BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
