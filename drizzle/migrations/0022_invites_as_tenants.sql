CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  note text,
  branding_preset_id uuid REFERENCES public.branding_presets(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users can read invites"
  ON public.invites FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage invites"
  ON public.invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL;
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_invite_idx ON public.events (invite_id);
CREATE INDEX IF NOT EXISTS families_invite_idx ON public.families (invite_id);
CREATE INDEX IF NOT EXISTS invite_codes_invite_idx ON public.invite_codes (invite_id);

INSERT INTO public.invites (name, note)
SELECT 'Main invitation', 'Created automatically for everything that already existed'
WHERE NOT EXISTS (SELECT 1 FROM public.invites);

UPDATE public.events SET invite_id = (SELECT id FROM public.invites ORDER BY created_at LIMIT 1) WHERE invite_id IS NULL;
UPDATE public.families SET invite_id = (SELECT id FROM public.invites ORDER BY created_at LIMIT 1) WHERE invite_id IS NULL;
UPDATE public.invite_codes SET invite_id = (SELECT id FROM public.invites ORDER BY created_at LIMIT 1) WHERE invite_id IS NULL;

CREATE OR REPLACE FUNCTION public.my_branding()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.settings
  FROM public.invite_codes i
  LEFT JOIN public.families f ON f.id = i.family_id
  JOIN public.invites v ON v.id = COALESCE(i.invite_id, f.invite_id)
  JOIN public.branding_presets p ON p.id = v.branding_preset_id
  WHERE i.claimed_by = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_event_ids()
RETURNS TABLE(event_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.household,
           (SELECT COALESCE(i.invite_id, f.invite_id)
              FROM public.invite_codes i
              LEFT JOIN public.families f ON f.id = i.family_id
             WHERE i.claimed_by = auth.uid()
             LIMIT 1) AS invite_id
    FROM public.profiles p WHERE p.id = auth.uid()
  ),
  mine AS (
    SELECT i.event_id
    FROM public.household_event_invites i, me
    WHERE me.household IS NOT NULL AND i.household = me.household
  )
  SELECT e.id
  FROM public.events e, me
  WHERE (me.invite_id IS NULL OR e.invite_id IS NULL OR e.invite_id = me.invite_id)
    AND (NOT EXISTS (SELECT 1 FROM mine) OR e.id IN (SELECT event_id FROM mine))
$$;