CREATE OR REPLACE FUNCTION public.tenancy_report()
RETURNS TABLE(table_name text, total bigint, unlinked bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'invite_id'
      AND c.table_name NOT LIKE 'celebration_%' AND c.table_name <> 'boutique_celebrations'
    ORDER BY 1
  LOOP
    RETURN QUERY EXECUTE format('SELECT %L::text, count(*), count(*) FILTER (WHERE invite_id IS NULL) FROM public.%I', t, t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.tenancy_report() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenancy_report() TO authenticated;