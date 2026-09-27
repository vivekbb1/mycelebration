create or replace function public.wake_outfit_import_worker(_base_url text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if _base_url !~ '^https://[a-z0-9.\-]+$' then raise exception 'bad url'; end if;
  perform net.http_post(
    url := _base_url || '/api/public/outfit-import-worker',
    headers := jsonb_build_object('content-type','application/json','x-worker-key',(select token from import_worker_key where id = 1)),
    body := jsonb_build_object('base', _base_url),
    timeout_milliseconds := 60000);
end $$;