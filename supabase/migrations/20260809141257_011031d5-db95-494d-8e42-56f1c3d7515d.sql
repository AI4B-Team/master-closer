revoke execute on function public.enforce_contact_suppression() from public;
revoke execute on function public.guard_agent_mode() from public;
revoke execute on function public.guard_agent_proposal() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.seed_agents_for_new_workspace() from public;
revoke execute on function public.seed_background_agents(uuid) from public;
revoke execute on function public.update_updated_at_column() from public;

revoke execute on function public.active_workspace_id() from public;
revoke execute on function public.auth_org_id() from public;
revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.workspace_role(uuid) from public;

grant execute on function public.active_workspace_id() to authenticated, service_role;
grant execute on function public.auth_org_id() to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;

grant execute on function public.seed_background_agents(uuid) to service_role;