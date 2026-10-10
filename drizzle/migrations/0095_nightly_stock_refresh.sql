CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION public.wake_stock_refresh(_base_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
begin
  if _base_url !~ '^https://[a-z0-9.\-]+$' then raise exception 'bad url'; end if;
  perform net.http_post(
    url := _base_url || '/api/public/stock-refresh',
    headers := jsonb_build_object('content-type','application/json','x-worker-key',(select token from import_worker_key where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
end $$;
REVOKE ALL ON FUNCTION public.wake_stock_refresh(text) FROM PUBLIC, anon, authenticated;