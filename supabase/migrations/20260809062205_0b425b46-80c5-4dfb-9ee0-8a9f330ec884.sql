create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  agent_id uuid references public.agents(id) on delete set null,
  mode text not null default 'copilot',
  prospect text not null,
  objection text,
  tone text,
  confidence integer not null default 0,
  line text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.practice_sessions to authenticated;
grant all on public.practice_sessions to service_role;

alter table public.practice_sessions enable row level security;

create policy "practice_sessions org access" on public.practice_sessions for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

create index if not exists practice_sessions_agent_idx on public.practice_sessions (agent_id, created_at desc);