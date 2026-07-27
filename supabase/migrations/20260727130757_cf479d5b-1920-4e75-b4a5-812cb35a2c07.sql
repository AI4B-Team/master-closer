
-- ENUMS
create type public.app_role as enum ('admin','manager','rep');
create type public.autonomy_mode as enum ('full_ai','hybrid','copilot');
create type public.deal_stage as enum ('new','qualifying','proposal','negotiation','won','lost');
create type public.call_outcome as enum ('scheduled','in_progress','completed','no_answer','voicemail','failed');
create type public.dial_outcome as enum ('connected','no_answer','voicemail','busy','failed','dnc');
create type public.consent_state as enum ('unknown','implied','express_written','opt_out');
create type public.lead_status as enum ('new','contacted','qualified','unqualified','customer');

-- ORGANIZATIONS
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role app_role not null default 'rep',
  unique(user_id, org_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- HELPER: org id of current user
create or replace function public.auth_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid() limit 1
$$;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Organization policies
create policy "org members can view org" on public.organizations for select to authenticated
  using (id = public.auth_org_id());
create policy "admins update org" on public.organizations for update to authenticated
  using (id = public.auth_org_id() and public.has_role(auth.uid(),'admin'));

-- Profile policies
create policy "view org profiles" on public.profiles for select to authenticated
  using (org_id = public.auth_org_id());
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid());

-- User role policies
create policy "view org roles" on public.user_roles for select to authenticated
  using (org_id = public.auth_org_id());
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (org_id = public.auth_org_id() and public.has_role(auth.uid(),'admin'))
  with check (org_id = public.auth_org_id() and public.has_role(auth.uid(),'admin'));

-- AUTO-PROVISION ORG + PROFILE + ADMIN ROLE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org_id uuid;
begin
  insert into public.organizations(name)
    values (coalesce(new.raw_user_meta_data->>'org_name', split_part(new.email,'@',1) || '''s Team'))
    returning id into new_org_id;
  insert into public.profiles(id, org_id, email, full_name, avatar_url)
    values (new.id, new_org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
            new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles(user_id, org_id, role) values (new.id, new_org_id, 'admin');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic org-scoped tables macro: define once
-- LEADS
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  title text,
  source text,
  status lead_status not null default 'new',
  tags text[] default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  consent consent_state not null default 'unknown',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "org leads all" on public.leads for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- DEALS
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  value numeric(12,2) not null default 0,
  stage deal_stage not null default 'new',
  close_probability int not null default 20,
  owner_id uuid references auth.users(id) on delete set null,
  expected_close_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;
alter table public.deals enable row level security;
create policy "org deals all" on public.deals for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- AGENTS (AI Closers)
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text,
  voice text default 'aria',
  default_mode autonomy_mode not null default 'hybrid',
  active boolean not null default true,
  transfer_to uuid references auth.users(id) on delete set null,
  system_prompt text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agents to authenticated;
grant all on public.agents to service_role;
alter table public.agents enable row level security;
create policy "org agents all" on public.agents for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- PLAYBOOKS
create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  content text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.playbooks to authenticated;
grant all on public.playbooks to service_role;
alter table public.playbooks enable row level security;
create policy "org playbooks all" on public.playbooks for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- OBJECTIONS
create table public.objections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trigger text not null,
  response text not null,
  category text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.objections to authenticated;
grant all on public.objections to service_role;
alter table public.objections enable row level security;
create policy "org objections all" on public.objections for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- CAMPAIGNS
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  mode autonomy_mode not null default 'copilot',
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "org campaigns all" on public.campaigns for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- CALL LISTS
create table public.call_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.call_lists to authenticated;
grant all on public.call_lists to service_role;
alter table public.call_lists enable row level security;
create policy "org lists all" on public.call_lists for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- LIST CONTACTS
create table public.list_contacts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.call_lists(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  attempts int not null default 0,
  last_outcome dial_outcome,
  consent consent_state not null default 'unknown'
);
grant select, insert, update, delete on public.list_contacts to authenticated;
grant all on public.list_contacts to service_role;
alter table public.list_contacts enable row level security;
create policy "org list contacts all" on public.list_contacts for all to authenticated
  using (exists(select 1 from public.call_lists cl where cl.id = list_id and cl.org_id = public.auth_org_id()))
  with check (exists(select 1 from public.call_lists cl where cl.id = list_id and cl.org_id = public.auth_org_id()));

-- DNC
create table public.dnc_list (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  phone text not null,
  reason text,
  added_at timestamptz not null default now(),
  unique(org_id, phone)
);
grant select, insert, update, delete on public.dnc_list to authenticated;
grant all on public.dnc_list to service_role;
alter table public.dnc_list enable row level security;
create policy "org dnc all" on public.dnc_list for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- DIAL SESSIONS
create table public.dial_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  rep_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  calls_made int not null default 0,
  connects int not null default 0
);
grant select, insert, update, delete on public.dial_sessions to authenticated;
grant all on public.dial_sessions to service_role;
alter table public.dial_sessions enable row level security;
create policy "org sessions all" on public.dial_sessions for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- CALLS
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  rep_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  list_contact_id uuid references public.list_contacts(id) on delete set null,
  mode autonomy_mode not null default 'copilot',
  outcome call_outcome not null default 'completed',
  disposition text,
  dial_outcome dial_outcome,
  duration_sec int not null default 0,
  close_probability int not null default 0,
  summary text,
  recording_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
grant select, insert, update, delete on public.calls to authenticated;
grant all on public.calls to service_role;
alter table public.calls enable row level security;
create policy "org calls all" on public.calls for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- TRANSCRIPT SEGMENTS
create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  speaker text not null,
  text text not null,
  ts_sec int not null default 0
);
grant select, insert, update, delete on public.transcript_segments to authenticated;
grant all on public.transcript_segments to service_role;
alter table public.transcript_segments enable row level security;
create policy "org transcripts all" on public.transcript_segments for all to authenticated
  using (exists(select 1 from public.calls c where c.id = call_id and c.org_id = public.auth_org_id()))
  with check (exists(select 1 from public.calls c where c.id = call_id and c.org_id = public.auth_org_id()));

-- SUGGESTIONS
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  objection text not null,
  line text not null,
  was_used boolean not null default false,
  ts_sec int not null default 0
);
grant select, insert, update, delete on public.suggestions to authenticated;
grant all on public.suggestions to service_role;
alter table public.suggestions enable row level security;
create policy "org suggestions all" on public.suggestions for all to authenticated
  using (exists(select 1 from public.calls c where c.id = call_id and c.org_id = public.auth_org_id()))
  with check (exists(select 1 from public.calls c where c.id = call_id and c.org_id = public.auth_org_id()));

-- CONSENT LOGS
create table public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid references public.calls(id) on delete cascade,
  method text not null,
  jurisdiction text,
  disclosed_at timestamptz not null default now(),
  notes text
);
grant select, insert, update, delete on public.consent_logs to authenticated;
grant all on public.consent_logs to service_role;
alter table public.consent_logs enable row level security;
create policy "org consent all" on public.consent_logs for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- INTEGRATIONS
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'not_connected',
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  unique(org_id, provider)
);
grant select, insert, update, delete on public.integrations to authenticated;
grant all on public.integrations to service_role;
alter table public.integrations enable row level security;
create policy "org integrations all" on public.integrations for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());
