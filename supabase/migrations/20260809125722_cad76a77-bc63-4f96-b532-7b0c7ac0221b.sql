-- ============ PROMPT 0: FOUNDATION ============
create table if not exists public.background_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  agent_key text not null,
  enabled boolean not null default true,
  mode text not null default 'flag_only' check (mode in ('off','flag_only','active')),
  interval_minutes int not null,
  last_run_at timestamptz,
  next_run_at timestamptz default now(),
  config jsonb not null default '{}',
  consecutive_failures int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, agent_key)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.background_agents(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  agent_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'ok' check (status in ('ok','failed','skipped')),
  items_examined int not null default 0,
  items_actioned int not null default 0,
  items_flagged int not null default 0,
  summary text,
  error text
);
create index if not exists agent_runs_agent_idx on public.agent_runs (agent_id, started_at desc);

create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.background_agents(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  agent_key text,
  proposal_type text not null check (proposal_type in ('profile_copy','cadence_timing','scorer_weights','booking_correction','objection_response')),
  target_table text,
  target_id uuid,
  target_field text,
  current_value jsonb,
  proposed_value jsonb,
  rationale text not null,
  evidence_refs jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists agent_proposals_ws_idx on public.agent_proposals (workspace_id, status, created_at desc);

create table if not exists public.conversation_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  call_id uuid references public.calls(id) on delete cascade,
  thread_id uuid,
  contact_id uuid,
  lead_line_id uuid,
  lead_id uuid references public.leads(id) on delete set null,
  outcome text not null,
  objection_category text,
  sentiment text check (sentiment in ('positive','neutral','negative','at_risk')),
  mode text check (mode in ('ai','hybrid','copilot')),
  touches_before_outcome int,
  anchor_days_remaining int,
  closer_profile_id uuid references public.agents(id) on delete set null,
  campaign_step_id uuid,
  variant_hash text,
  confidence numeric,
  flagged boolean not null default false,
  superseded_at timestamptz,
  labeled_at timestamptz not null default now(),
  labeler_version text
);
create index if not exists conversation_outcomes_ws_idx on public.conversation_outcomes (workspace_id, labeled_at desc);
create unique index if not exists conversation_outcomes_active_call_idx
  on public.conversation_outcomes (call_id) where superseded_at is null;

-- ============ PROMPT 1: MULTI-PRODUCT LEAD LINES ============
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  name text,
  phone text,
  email text,
  timezone text,
  address text,
  suppressed boolean not null default false,
  suppressed_at timestamptz,
  crm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_ws_idx on public.contacts (workspace_id, created_at desc);

create table if not exists public.lead_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  product_line text not null,
  closer_profile_id uuid references public.agents(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  disposition text,
  stage text,
  status text not null default 'inactive' check (status in ('inactive','live','paused','completed')),
  anchor_date date,
  anchor_type text,
  last_touch_at timestamptz,
  touches int not null default 0,
  eligible_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, product_line)
);
create unique index if not exists lead_lines_one_live_per_contact
  on public.lead_lines (contact_id) where status = 'live';
create index if not exists lead_lines_ws_idx on public.lead_lines (workspace_id, status);

-- contact-level suppression is absolute across every line
create or replace function public.enforce_contact_suppression()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.disposition is not null and lower(new.disposition) in ('opted_out','opt_out','do_not_call','dnc') then
    update public.contacts
       set suppressed = true,
           suppressed_at = coalesce(suppressed_at, now()),
           updated_at = now()
     where id = new.contact_id and suppressed = false;
  end if;
  if exists (select 1 from public.contacts c where c.id = new.contact_id and c.suppressed)
     and new.status = 'live' then
    new.status := 'paused';
  end if;
  return new;
end $$;
drop trigger if exists lead_lines_suppression on public.lead_lines;
create trigger lead_lines_suppression before insert or update on public.lead_lines
  for each row execute function public.enforce_contact_suppression();

-- ============ WORKLIST / SCORER / TAKEOVERS ============
create table if not exists public.worklist_nominations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  lead_line_id uuid references public.lead_lines(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  score numeric not null default 0,
  reason_code text not null,
  reason_text text not null,
  suggested boolean not null default true,
  nominated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 days'
);
create index if not exists worklist_nominations_ws_idx on public.worklist_nominations (workspace_id, score desc);

create table if not exists public.worklist_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nomination_id uuid references public.worklist_nominations(id) on delete cascade,
  contact_id uuid,
  lead_line_id uuid,
  lead_id uuid,
  action text not null check (action in ('worked','not_hot','dismiss')),
  score_at_action numeric,
  undone boolean not null default false,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists worklist_feedback_ws_idx on public.worklist_feedback (workspace_id, created_at desc);

create table if not exists public.scorer_weights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_line text not null default 'default',
  weights jsonb not null default '{}',
  is_default boolean not null default true,
  fitted_on int not null default 0,
  fitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (workspace_id, product_line)
);

create table if not exists public.takeover_library (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  call_id uuid references public.calls(id) on delete cascade,
  closer_profile_id uuid references public.agents(id) on delete set null,
  mode text,
  objection_category text,
  ai_drafted text,
  human_said text,
  subsequent_outcome text,
  sentiment text,
  anchor_days int,
  positive boolean not null default false,
  created_at timestamptz not null default now(),
  unique (call_id, human_said)
);
create index if not exists takeover_library_ws_idx on public.takeover_library (workspace_id, objection_category);

-- ============ HARD CONSTRAINTS ============
create or replace function public.guard_agent_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  guarded text[] := array['disclosure','disclosure_script','opt_out','opt_out_line','sender_identity',
                          'escalation_triggers','banned_topics','handoff_patterns','regex_precheck'];
  cur text;
  prop text;
begin
  -- never target compliance stores
  if new.target_table in ('consent_logs','dnc_list','disclosure_settings') then
    raise exception 'Proposals may not target compliance records (%).', new.target_table;
  end if;
  -- the Coach never applies anything
  if new.agent_key = 'coach' and new.status = 'approved' and new.proposal_type <> 'profile_copy' then
    raise exception 'The Coach may only propose closer-profile copy.';
  end if;
  -- subtractive proposals against guardrails are rejected at write time
  if new.target_field is not null and new.target_field = any (guarded) then
    cur := coalesce(new.current_value #>> '{}', '');
    prop := coalesce(new.proposed_value #>> '{}', '');
    if length(prop) < length(cur) or position(cur in prop) = 0 then
      raise exception 'Subtractive proposals against guardrail "%" are not allowed.', new.target_field;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists agent_proposals_guard on public.agent_proposals;
create trigger agent_proposals_guard before insert or update on public.agent_proposals
  for each row execute function public.guard_agent_proposal();

create or replace function public.guard_agent_mode()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agent_key = 'coach' and new.mode = 'active' then
    raise exception 'The Coach has no active mode; it proposes only.';
  end if;
  return new;
end $$;
drop trigger if exists background_agents_guard on public.background_agents;
create trigger background_agents_guard before insert or update on public.background_agents
  for each row execute function public.guard_agent_mode();

-- ============ REGISTRY SEEDING ============
create or replace function public.seed_background_agents(ws uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.background_agents (workspace_id, agent_key, interval_minutes, mode)
  values (ws,'conversation_labeler',60,'flag_only'),
         (ws,'lead_scout',180,'flag_only'),
         (ws,'hot_lead_scorer',10080,'flag_only'),
         (ws,'booking_auditor',15,'flag_only'),
         (ws,'coach',10080,'flag_only'),
         (ws,'wisdom_miner',45,'flag_only')
  on conflict (workspace_id, agent_key) do nothing;
end $$;

create or replace function public.seed_agents_for_new_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_background_agents(new.id);
  return new;
end $$;
drop trigger if exists workspaces_seed_agents on public.workspaces;
create trigger workspaces_seed_agents after insert on public.workspaces
  for each row execute function public.seed_agents_for_new_workspace();

do $$
declare w record;
begin
  for w in select id from public.workspaces loop
    perform public.seed_background_agents(w.id);
  end loop;
end $$;

-- ============ GRANTS + RLS ============
grant select, insert, update, delete on public.background_agents to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.lead_lines to authenticated;
grant select, insert, update, delete on public.worklist_feedback to authenticated;
grant select, insert, update, delete on public.agent_proposals to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.conversation_outcomes to authenticated;
grant select on public.worklist_nominations to authenticated;
grant select on public.scorer_weights to authenticated;
grant select on public.takeover_library to authenticated;
grant all on public.background_agents, public.agent_runs, public.agent_proposals,
  public.conversation_outcomes, public.contacts, public.lead_lines,
  public.worklist_nominations, public.worklist_feedback, public.scorer_weights,
  public.takeover_library to service_role;

alter table public.background_agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_proposals enable row level security;
alter table public.conversation_outcomes enable row level security;
alter table public.contacts enable row level security;
alter table public.lead_lines enable row level security;
alter table public.worklist_nominations enable row level security;
alter table public.worklist_feedback enable row level security;
alter table public.scorer_weights enable row level security;
alter table public.takeover_library enable row level security;

create policy "members manage agents" on public.background_agents for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "members read runs" on public.agent_runs for select to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "members manage proposals" on public.agent_proposals for all to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id))
  with check (workspace_id is not null and public.is_workspace_member(workspace_id));

create policy "members read outcomes" on public.conversation_outcomes for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members manage contacts" on public.contacts for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "members manage lead lines" on public.lead_lines for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "members read nominations" on public.worklist_nominations for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members manage feedback" on public.worklist_feedback for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "members read weights" on public.scorer_weights for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members read takeovers" on public.takeover_library for select to authenticated
  using (public.is_workspace_member(workspace_id));