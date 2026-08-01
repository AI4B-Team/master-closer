-- Hub federation columns
alter table public.organizations add column if not exists real_elite_org_id uuid;
create unique index if not exists organizations_real_elite_org_id_key on public.organizations(real_elite_org_id) where real_elite_org_id is not null;

alter table public.profiles add column if not exists real_elite_user_id uuid;
create unique index if not exists profiles_real_elite_user_id_key on public.profiles(real_elite_user_id) where real_elite_user_id is not null;

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "org events view" on public.events for select to authenticated
  using (org_id = public.auth_org_id());
create policy "org events insert" on public.events for insert to authenticated
  with check (org_id = public.auth_org_id());
create index if not exists events_org_created_idx on public.events(org_id, created_at desc);

-- ORG WEBHOOKS
create table if not exists public.org_webhooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.org_webhooks to authenticated;
grant all on public.org_webhooks to service_role;
alter table public.org_webhooks enable row level security;
create policy "org webhooks admin manage" on public.org_webhooks for all to authenticated
  using (org_id = public.auth_org_id() and public.has_role(auth.uid(),'admin'))
  with check (org_id = public.auth_org_id() and public.has_role(auth.uid(),'admin'));

-- Delivery log so dispatch is idempotent
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  webhook_id uuid not null references public.org_webhooks(id) on delete cascade,
  status_code int,
  error text,
  delivered_at timestamptz not null default now(),
  unique(event_id, webhook_id)
);
grant select on public.webhook_deliveries to authenticated;
grant all on public.webhook_deliveries to service_role;
alter table public.webhook_deliveries enable row level security;
create policy "org deliveries view" on public.webhook_deliveries for select to authenticated
  using (exists (select 1 from public.org_webhooks w where w.id = webhook_id and w.org_id = public.auth_org_id()));

-- Hub link helper: stamp canonical ids onto an existing org/profile
create or replace function public.link_org_to_hub(_reo_org_id uuid, _reo_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select org_id into _org from public.profiles where id = auth.uid();
  if _org is null then raise exception 'no profile'; end if;
  update public.organizations set real_elite_org_id = _reo_org_id
    where id = _org and real_elite_org_id is null;
  update public.profiles set real_elite_user_id = _reo_user_id
    where id = auth.uid() and real_elite_user_id is null;
end $$;