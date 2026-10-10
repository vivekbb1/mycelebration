CREATE OR REPLACE FUNCTION public.drop_blank_measurement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.height IS NULL AND NEW.bust IS NULL AND NEW.waist IS NULL AND NEW.hip IS NULL AND NEW.shoulder IS NULL
     AND NEW.sleeve_length IS NULL AND NEW.top_length IS NULL AND NEW.bottom_length IS NULL AND NEW.inseam IS NULL
     AND NEW.chest IS NULL AND NEW.under_bust IS NULL AND NEW.armhole IS NULL AND NEW.neck IS NULL
     AND NULLIF(trim(COALESCE(NEW.usual_size, '')), '') IS NULL AND NULLIF(trim(COALESCE(NEW.notes, '')), '') IS NULL THEN
    DELETE FROM public.measurements WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS measurements_drop_blank ON public.measurements;
CREATE TRIGGER measurements_drop_blank AFTER INSERT OR UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.drop_blank_measurement();
DELETE FROM public.measurements WHERE height IS NULL AND bust IS NULL AND waist IS NULL AND hip IS NULL AND shoulder IS NULL
  AND sleeve_length IS NULL AND top_length IS NULL AND bottom_length IS NULL AND inseam IS NULL
  AND chest IS NULL AND under_bust IS NULL AND armhole IS NULL AND neck IS NULL
  AND NULLIF(trim(COALESCE(usual_size, '')), '') IS NULL AND NULLIF(trim(COALESCE(notes, '')), '') IS NULL;