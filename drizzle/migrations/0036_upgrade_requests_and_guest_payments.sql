-- 1. Hosts can ask for a package / add-ons themselves; the platform owner approves.
CREATE TABLE public.plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text REFERENCES public.plans(id) ON DELETE SET NULL,
  addon_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_requests TO authenticated;
GRANT ALL ON public.plan_requests TO service_role;

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts see their own requests"
  ON public.plan_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Hosts make their own requests"
  ON public.plan_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Platform admins decide requests"
  ON public.plan_requests FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins remove requests"
  ON public.plan_requests FOR DELETE TO authenticated
  USING (public.is_platform_admin());

CREATE TRIGGER plan_requests_updated_at BEFORE UPDATE ON public.plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX plan_requests_one_open_per_host
  ON public.plan_requests (user_id) WHERE status = 'pending';

-- 2. How guests should pay, written by the host on their event.
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS pay_instructions text;

CREATE OR REPLACE FUNCTION public.my_pay_instructions()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.pay_instructions
  FROM public.invite_codes i
  LEFT JOIN public.families f ON f.id = i.family_id
  JOIN public.invites v ON v.id = COALESCE(i.invite_id, f.invite_id)
  WHERE i.claimed_by = auth.uid()
  LIMIT 1
$$;

-- 3. Guests can record a payment they have sent; the host confirms it.
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS confirmed_by uuid;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS reference text;

CREATE POLICY "Guests record their own payment"
  ON public.fee_payments FOR INSERT TO authenticated
  WITH CHECK (
    payer_kind = 'guest'
    AND confirmed_at IS NULL
    AND household IS NOT NULL
    AND household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid())
  );