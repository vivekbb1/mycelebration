CREATE TABLE public.tailor_workmen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tailor_workmen TO authenticated;
GRANT ALL ON public.tailor_workmen TO service_role;
ALTER TABLE public.tailor_workmen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage tailor workmen" ON public.tailor_workmen FOR ALL TO authenticated
  USING (public.is_celebration_host(invite_id)) WITH CHECK (public.is_celebration_host(invite_id));
CREATE OR REPLACE FUNCTION public.guard_tailor_workman() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = NEW.vendor_id AND v.invite_id = NEW.invite_id) THEN
    RAISE EXCEPTION 'Tailor must belong to this celebration';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_tailor_workman BEFORE INSERT OR UPDATE ON public.tailor_workmen FOR EACH ROW EXECUTE FUNCTION public.guard_tailor_workman();
ALTER TABLE public.wardrobe_alterations ADD COLUMN IF NOT EXISTS workman_id uuid REFERENCES public.tailor_workmen(id) ON DELETE SET NULL;
ALTER TABLE public.wardrobe_alterations ADD COLUMN IF NOT EXISTS adjustments text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tailor_notes text NOT NULL DEFAULT '';