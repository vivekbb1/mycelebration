CREATE TABLE public.household_event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household, event_id)
);

CREATE INDEX household_event_invites_household_idx ON public.household_event_invites (household);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_event_invites TO authenticated;
GRANT ALL ON public.household_event_invites TO service_role;

ALTER TABLE public.household_event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage household event invites"
  ON public.household_event_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "guests read own household invites"
  ON public.household_event_invites FOR SELECT TO authenticated
  USING (household = (SELECT p.household FROM public.profiles p WHERE p.id = auth.uid()));

CREATE OR REPLACE FUNCTION public.my_event_ids()
RETURNS TABLE(event_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT household FROM public.profiles WHERE id = auth.uid()),
  mine AS (
    SELECT i.event_id
    FROM public.household_event_invites i, me
    WHERE me.household IS NOT NULL AND i.household = me.household
  )
  SELECT e.id
  FROM public.events e
  WHERE NOT EXISTS (SELECT 1 FROM mine)
     OR e.id IN (SELECT event_id FROM mine)
$$;

GRANT EXECUTE ON FUNCTION public.my_event_ids() TO authenticated;
