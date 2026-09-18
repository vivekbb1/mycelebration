CREATE TABLE public.guest_host_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  from_host uuid,
  to_host uuid NOT NULL,
  reason text,
  effective_on date NOT NULL DEFAULT current_date,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_host_transfers_invite_idx ON public.guest_host_transfers (invite_id);
CREATE INDEX guest_host_transfers_pending_idx ON public.guest_host_transfers (effective_on) WHERE applied_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_host_transfers TO authenticated;
GRANT ALL ON public.guest_host_transfers TO service_role;

ALTER TABLE public.guest_host_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage guest transfers"
ON public.guest_host_transfers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.apply_due_guest_transfers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  moved integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM public.guest_host_transfers
    WHERE applied_at IS NULL AND effective_on <= current_date
    ORDER BY effective_on, created_at
  LOOP
    IF r.from_host IS NOT NULL THEN
      DELETE FROM public.guest_hosts
      WHERE invite_id = r.invite_id AND host_id = r.from_host;
    END IF;

    INSERT INTO public.guest_hosts (invite_id, host_id, note)
    VALUES (r.invite_id, r.to_host, r.reason)
    ON CONFLICT (invite_id, host_id) DO NOTHING;

    UPDATE public.guest_host_transfers SET applied_at = now() WHERE id = r.id;
    moved := moved + 1;
  END LOOP;

  RETURN moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_due_guest_transfers() TO authenticated;