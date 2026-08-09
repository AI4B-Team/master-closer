create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  name text not null,
  slug text unique not null,
  logo_url text,
  brand_color text not null default '#CC0000',
  legal_business_name text,
  business_state text,
  default_caller_id text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;
alter table public.workspace_members enable row level security;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  token text unique not null,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.workspace_invites to authenticated;
grant all on public.workspace_invites to service_role;
alter table public.workspace_invites enable row level security;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$$;

create policy "workspace members can view workspace"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "workspace owners and admins can update workspace"
  on public.workspaces for update to authenticated
  using (public.is_workspace_member(id) and public.workspace_role(id) in ('owner','admin'));

create policy "workspace members can view members"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace owners and admins manage members"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'))
  with check (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'));

create policy "workspace members can view invites"
  on public.workspace_invites for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace owners and admins manage invites"
  on public.workspace_invites for all to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'))
  with check (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'));

alter table public.profiles add column if not exists active_workspace_id uuid references public.workspaces(id);

create or replace function public.active_workspace_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select active_workspace_id from public.profiles where id = auth.uid() limit 1;
$$;

alter table public.leads              add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.deals              add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.agents             add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.playbooks          add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.objections         add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.campaigns          add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.call_lists         add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.list_contacts      add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.dnc_list           add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.dial_sessions      add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calls              add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.consent_logs       add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.integrations       add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.pipeline_stages    add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.tasks              add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.events             add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.org_webhooks       add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.webhook_deliveries add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.custom_voices      add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.practice_sessions  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.disclosure_settings add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.agreements         add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.transcript_segments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.suggestions        add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

insert into public.workspaces (org_id, owner_id, name, slug, brand_color, legal_business_name, timezone)
select o.id,
       p.id,
       o.name,
       lower(regexp_replace(o.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(o.id::text, 1, 8),
       '#CC0000',
       o.name,
       'America/New_York'
from public.organizations o
join public.profiles p on p.org_id = o.id
join public.user_roles r on r.user_id = p.id and r.role = 'admin'
where not exists (select 1 from public.workspaces w where w.org_id = o.id)
order by p.created_at nulls last
limit 1;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, r.user_id,
  case
    when r.role = 'admin' and not exists (select 1 from public.workspace_members m2 where m2.workspace_id = w.id and m2.role = 'owner') then 'owner'
    when r.role = 'admin' then 'admin'
    else 'member'
  end
from public.workspaces w
join public.user_roles r on r.org_id = w.org_id
where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = r.user_id);

update public.profiles p
set active_workspace_id = w.id
from public.workspaces w
where w.org_id = p.org_id and p.active_workspace_id is null;

update public.leads              set workspace_id = w.id from public.workspaces w where w.org_id = leads.org_id and leads.workspace_id is null;
update public.deals              set workspace_id = w.id from public.workspaces w where w.org_id = deals.org_id and deals.workspace_id is null;
update public.agents             set workspace_id = w.id from public.workspaces w where w.org_id = agents.org_id and agents.workspace_id is null;
update public.playbooks          set workspace_id = w.id from public.workspaces w where w.org_id = playbooks.org_id and playbooks.workspace_id is null;
update public.objections         set workspace_id = w.id from public.workspaces w where w.org_id = objections.org_id and objections.workspace_id is null;
update public.campaigns          set workspace_id = w.id from public.workspaces w where w.org_id = campaigns.org_id and campaigns.workspace_id is null;
update public.call_lists         set workspace_id = w.id from public.workspaces w where w.org_id = call_lists.org_id and call_lists.workspace_id is null;
update public.list_contacts      set workspace_id = cl.workspace_id from public.call_lists cl where cl.id = list_contacts.list_id and list_contacts.workspace_id is null;
update public.dnc_list           set workspace_id = w.id from public.workspaces w where w.org_id = dnc_list.org_id and dnc_list.workspace_id is null;
update public.dial_sessions      set workspace_id = w.id from public.workspaces w where w.org_id = dial_sessions.org_id and dial_sessions.workspace_id is null;
update public.calls              set workspace_id = w.id from public.workspaces w where w.org_id = calls.org_id and calls.workspace_id is null;
update public.consent_logs       set workspace_id = w.id from public.workspaces w where w.org_id = consent_logs.org_id and consent_logs.workspace_id is null;
update public.integrations       set workspace_id = w.id from public.workspaces w where w.org_id = integrations.org_id and integrations.workspace_id is null;
update public.pipeline_stages    set workspace_id = w.id from public.workspaces w where w.org_id = pipeline_stages.org_id and pipeline_stages.workspace_id is null;
update public.tasks              set workspace_id = w.id from public.workspaces w where w.org_id = tasks.org_id and tasks.workspace_id is null;
update public.events             set workspace_id = w.id from public.workspaces w where w.org_id = events.org_id and events.workspace_id is null;
update public.org_webhooks       set workspace_id = w.id from public.workspaces w where w.org_id = org_webhooks.org_id and org_webhooks.workspace_id is null;
update public.webhook_deliveries set workspace_id = ow.workspace_id from public.org_webhooks ow where ow.id = webhook_deliveries.webhook_id and webhook_deliveries.workspace_id is null;
update public.custom_voices      set workspace_id = w.id from public.workspaces w where w.org_id = custom_voices.org_id and custom_voices.workspace_id is null;
update public.practice_sessions  set workspace_id = w.id from public.workspaces w where w.org_id = practice_sessions.org_id and practice_sessions.workspace_id is null;
update public.disclosure_settings set workspace_id = w.id from public.workspaces w where w.org_id = disclosure_settings.org_id and disclosure_settings.workspace_id is null;
update public.agreements         set workspace_id = w.id from public.workspaces w where w.org_id = agreements.org_id and agreements.workspace_id is null;

update public.transcript_segments set workspace_id = c.workspace_id from public.calls c where c.id = transcript_segments.call_id and transcript_segments.workspace_id is null;
update public.suggestions        set workspace_id = c.workspace_id from public.calls c where c.id = suggestions.call_id and suggestions.workspace_id is null;

alter table public.leads              alter column workspace_id set not null;
alter table public.deals              alter column workspace_id set not null;
alter table public.agents             alter column workspace_id set not null;
alter table public.playbooks          alter column workspace_id set not null;
alter table public.objections         alter column workspace_id set not null;
alter table public.campaigns          alter column workspace_id set not null;
alter table public.call_lists         alter column workspace_id set not null;
alter table public.list_contacts      alter column workspace_id set not null;
alter table public.dnc_list           alter column workspace_id set not null;
alter table public.dial_sessions      alter column workspace_id set not null;
alter table public.calls              alter column workspace_id set not null;
alter table public.consent_logs       alter column workspace_id set not null;
alter table public.integrations       alter column workspace_id set not null;
alter table public.pipeline_stages    alter column workspace_id set not null;
alter table public.tasks              alter column workspace_id set not null;
alter table public.events             alter column workspace_id set not null;
alter table public.org_webhooks       alter column workspace_id set not null;
alter table public.webhook_deliveries alter column workspace_id set not null;
alter table public.custom_voices      alter column workspace_id set not null;
alter table public.practice_sessions  alter column workspace_id set not null;
alter table public.disclosure_settings alter column workspace_id set not null;
alter table public.agreements         alter column workspace_id set not null;
alter table public.transcript_segments alter column workspace_id set not null;
alter table public.suggestions        alter column workspace_id set not null;

drop policy if exists "org leads all" on public.leads;
drop policy if exists "org deals all" on public.deals;
drop policy if exists "org agents all" on public.agents;
drop policy if exists "org playbooks all" on public.playbooks;
drop policy if exists "org objections all" on public.objections;
drop policy if exists "org campaigns all" on public.campaigns;
drop policy if exists "org lists all" on public.call_lists;
drop policy if exists "org list contacts all" on public.list_contacts;
drop policy if exists "org dnc all" on public.dnc_list;
drop policy if exists "org sessions all" on public.dial_sessions;
drop policy if exists "org calls all" on public.calls;
drop policy if exists "org transcripts all" on public.transcript_segments;
drop policy if exists "org suggestions all" on public.suggestions;
drop policy if exists "org consent all" on public.consent_logs;
drop policy if exists "org integrations all" on public.integrations;
drop policy if exists "Org members manage pipeline stages" on public.pipeline_stages;
drop policy if exists "org members manage tasks" on public.tasks;
drop policy if exists "org events view" on public.events;
drop policy if exists "org events insert" on public.events;
drop policy if exists "org webhooks admin manage" on public.org_webhooks;
drop policy if exists "org deliveries view" on public.webhook_deliveries;
drop policy if exists "org custom voices all" on public.custom_voices;
drop policy if exists "practice_sessions org access" on public.practice_sessions;
drop policy if exists "org disclosure settings all" on public.disclosure_settings;
drop policy if exists "org members manage agreements" on public.agreements;

create policy "workspace leads all" on public.leads for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace deals all" on public.deals for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace agents all" on public.agents for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace playbooks all" on public.playbooks for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace objections all" on public.objections for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace campaigns all" on public.campaigns for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace call_lists all" on public.call_lists for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace list_contacts all" on public.list_contacts for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace dnc_list all" on public.dnc_list for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace dial_sessions all" on public.dial_sessions for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace calls all" on public.calls for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace transcript_segments all" on public.transcript_segments for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace suggestions all" on public.suggestions for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace consent_logs all" on public.consent_logs for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace integrations all" on public.integrations for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace pipeline_stages all" on public.pipeline_stages for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace tasks all" on public.tasks for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace events all" on public.events for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace org_webhooks all" on public.org_webhooks for all to authenticated
  using (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'))
  with check (public.is_workspace_member(workspace_id) and public.workspace_role(workspace_id) in ('owner','admin'));
create policy "workspace webhook_deliveries all" on public.webhook_deliveries for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace custom_voices all" on public.custom_voices for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace practice_sessions all" on public.practice_sessions for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace disclosure_settings all" on public.disclosure_settings for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace agreements all" on public.agreements for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create trigger update_workspaces_updated_at before update on public.workspaces
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  new_workspace_id uuid;
begin
  insert into public.organizations(name)
    values (coalesce(new.raw_user_meta_data->>'org_name', split_part(new.email,'@',1) || '''s Team'))
    returning id into new_org_id;

  insert into public.profiles(id, org_id, email, full_name, avatar_url)
    values (new.id, new_org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
            new.raw_user_meta_data->>'avatar_url');

  insert into public.user_roles(user_id, org_id, role) values (new.id, new_org_id, 'admin');

  insert into public.workspaces(org_id, owner_id, name, slug, brand_color, legal_business_name, timezone)
    values (new_org_id, new.id, split_part(new.email,'@',1) || '''s Workspace',
            lower(regexp_replace(split_part(new.email,'@',1) || '''s Workspace', '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8),
            '#CC0000', split_part(new.email,'@',1) || '''s Workspace', 'America/New_York')
    returning id into new_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
    values (new_workspace_id, new.id, 'owner');

  update public.profiles set active_workspace_id = new_workspace_id where id = new.id;

  return new;
end $$;