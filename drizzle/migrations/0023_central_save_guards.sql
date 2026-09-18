ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS branding_updated_at ON public.branding;
CREATE TRIGGER branding_updated_at BEFORE UPDATE ON public.branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS branding_presets_updated_at ON public.branding_presets;
CREATE TRIGGER branding_presets_updated_at BEFORE UPDATE ON public.branding_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS invites_updated_at ON public.invites;
CREATE TRIGGER invites_updated_at BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS site_content_updated_at ON public.site_content;
CREATE TRIGGER site_content_updated_at BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS email_settings_updated_at ON public.email_settings;
CREATE TRIGGER email_settings_updated_at BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS travel_plans_one_row_per_person
  ON public.travel_plans (household, COALESCE(guest_name, ''));

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_one_row_per_family_member
  ON public.invite_codes (family_id, lower(guest_name))
  WHERE family_id IS NOT NULL;
