-- Trigger + internal-only functions: no direct API execution
revoke execute on function public.enforce_contact_suppression() from anon, authenticated;
revoke execute on function public.guard_agent_mode() from anon, authenticated;
revoke execute on function public.guard_agent_proposal() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.seed_agents_for_new_workspace() from anon, authenticated;
revoke execute on function public.seed_background_agents(uuid) from anon, authenticated;
revoke execute on function public.update_updated_at_column() from anon, authenticated;

-- RLS helper functions: keep for signed-in users (policies rely on them), block anonymous
revoke execute on function public.active_workspace_id() from anon;
revoke execute on function public.auth_org_id() from anon;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.is_workspace_member(uuid) from anon;
revoke execute on function public.workspace_role(uuid) from anon;