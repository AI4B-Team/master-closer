alter table public.agents add column if not exists voices text[] not null default '{}'::text[];

update public.agents set voices = array[voice] where voice is not null and cardinality(voices) = 0;

create table if not exists public.custom_voices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  base_voice text not null default 'alloy',
  style text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.custom_voices to authenticated;
grant all on public.custom_voices to service_role;

alter table public.custom_voices enable row level security;

create policy "custom_voices org access" on public.custom_voices for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());