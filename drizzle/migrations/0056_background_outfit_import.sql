create extension if not exists pg_net;

create table public.outfit_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  event_id uuid,
  boutique_id uuid,
  gender text,
  total int not null default 0,
  imported int not null default 0,
  skipped int not null default 0,
  failed int not null default 0,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
grant select, insert, update on public.outfit_import_jobs to authenticated;
grant all on public.outfit_import_jobs to service_role;
alter table public.outfit_import_jobs enable row level security;
create policy "Hosts manage import jobs" on public.outfit_import_jobs for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.outfit_import_items (
  id bigserial primary key,
  job_id uuid not null references public.outfit_import_jobs(id) on delete cascade,
  slug text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  claimed_at timestamptz
);
create index on public.outfit_import_items (status, id);
grant select, insert on public.outfit_import_items to authenticated;
grant usage on sequence public.outfit_import_items_id_seq to authenticated;
grant all on public.outfit_import_items to service_role;
grant all on sequence public.outfit_import_items_id_seq to service_role;
alter table public.outfit_import_items enable row level security;
create policy "Hosts manage import items" on public.outfit_import_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.claim_outfit_import_item()
returns table(item_id bigint, job_id uuid, slug text)
language plpgsql security definer set search_path = public as $$
begin
  update outfit_import_items set status = 'pending'
    where status = 'working' and claimed_at < now() - interval '5 minutes' and attempts < 2;
  return query
  update outfit_import_items i set status = 'working', claimed_at = now(), attempts = i.attempts + 1
  where i.id = (select x.id from outfit_import_items x join outfit_import_jobs j on j.id = x.job_id
                where x.status = 'pending' and j.status = 'running'
                order by x.id limit 1 for update of x skip locked)
  returning i.id, i.job_id, i.slug;
end $$;
revoke all on function public.claim_outfit_import_item() from public, anon, authenticated;
grant execute on function public.claim_outfit_import_item() to service_role;

create table public.import_worker_key (id int primary key default 1, token text not null default encode(extensions.gen_random_bytes(24),'hex'));
insert into public.import_worker_key default values;
grant all on public.import_worker_key to service_role;
alter table public.import_worker_key enable row level security;

-- Wakes the background worker from inside the database, so the chain keeps
-- going even after the host closes the browser.
create or replace function public.wake_outfit_import_worker(_base_url text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if _base_url !~ '^https://[a-z0-9.\-]+$' then raise exception 'bad url'; end if;
  perform net.http_post(
    url := _base_url || '/api/public/outfit-import-worker',
    headers := jsonb_build_object('content-type','application/json','x-worker-key',(select token from import_worker_key where id = 1)),
    body := jsonb_build_object('base', _base_url),
    timeout_milliseconds := 5000);
end $$;
revoke all on function public.wake_outfit_import_worker(text) from public, anon, authenticated;
grant execute on function public.wake_outfit_import_worker(text) to service_role;