CREATE OR REPLACE FUNCTION public.log_host_travel_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE msg text := ''; who text; col text; o text; n text; cols text[];
BEGIN
  IF auth.uid() IS NULL OR NEW.invite_id IS NULL OR NOT public.is_celebration_host(NEW.invite_id) THEN RETURN NEW; END IF;
  NEW.updated_by := auth.uid();
  IF TG_TABLE_NAME = 'travel_plans' THEN
    cols := ARRAY['arrival_date','arrival_time','arrival_flight','departure_date','departure_time','departure_flight','checkin_date','checkin_time','checkout_date','checkout_time','party_size','travellers','notes'];
  ELSE
    cols := ARRAY['first_name','last_name','date_of_birth','passport_number','nationality','expiry','doc_path'];
  END IF;
  FOREACH col IN ARRAY cols LOOP
    IF TG_OP = 'UPDATE' THEN o := to_jsonb(OLD) ->> col; ELSE o := NULL; END IF;
    n := to_jsonb(NEW) ->> col;
    IF o IS DISTINCT FROM n THEN
      msg := msg || replace(col, '_', ' ') || ': ' || COALESCE(o, '—') || ' → ' || COALESCE(n, '—') || E'\n';
    END IF;
  END LOOP;
  IF msg <> '' THEN
    SELECT full_name INTO who FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.family_notes(invite_id, household, body, author_id, author_name, is_change_log)
    VALUES (NEW.invite_id, NEW.household,
      CASE WHEN TG_TABLE_NAME = 'travel_plans' THEN 'Travel updated by host'
           ELSE 'Passport updated by host for ' || COALESCE(to_jsonb(NEW) ->> 'person_name', '') END || E'\n' || msg,
      auth.uid(), who, true);
  END IF;
  RETURN NEW;
END $$;