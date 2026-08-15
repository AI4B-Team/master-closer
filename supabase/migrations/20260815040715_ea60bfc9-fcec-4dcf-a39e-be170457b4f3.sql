-- Harden SECURITY DEFINER helper functions: lock down who may execute them
-- and prevent signed-in users from probing other users' roles.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
      -- callers may only ask about themselves; privileged server code
      -- (service_role) may ask about anyone.
      and (_user_id = auth.uid() or current_setting('role', true) = 'service_role')
  )
$function$;

-- Remove implicit PUBLIC/anon execute rights on all SECURITY DEFINER helpers.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.active_workspace_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auth_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_background_agents(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_stale_calls() FROM PUBLIC, anon, authenticated;

-- Row-level policies evaluate these helpers as the querying role, so signed-in
-- users still need EXECUTE on the four policy helpers.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_background_agents(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_stale_calls() TO service_role;