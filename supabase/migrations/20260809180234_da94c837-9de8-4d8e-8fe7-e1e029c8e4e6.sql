create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  cadence text not null default 'weekly' check (cadence in ('daily','weekly')),
  send_hour_utc int not null default 13 check (send_hour_utc between 0 and 23),
  weekday int not null default 1 check (weekday between 0 and 6),
  recipients text[] not null default '{}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index report_schedules_due_idx on public.report_schedules (enabled, next_run_at);
create index report_schedules_workspace_idx on public.report_schedules (workspace_id);

grant select, insert, update, delete on public.report_schedules to authenticated;
grant all on public.report_schedules to service_role;

alter table public.report_schedules enable row level security;

create policy "Workspace members manage report schedules"
  on public.report_schedules for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));