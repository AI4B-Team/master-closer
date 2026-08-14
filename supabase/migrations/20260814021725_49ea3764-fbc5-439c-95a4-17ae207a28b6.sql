ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS core_workspace_id uuid,
  ADD COLUMN IF NOT EXISTS core_legal_entity_id uuid,
  ADD COLUMN IF NOT EXISTS core_linked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_core_workspace_id_key
  ON public.workspaces (core_workspace_id) WHERE core_workspace_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.core_policy_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  core_workspace_id uuid,
  action text NOT NULL,
  channel text,
  identifier text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  decision text NOT NULL,
  denied_by text,
  reason text,
  policy_check_id text,
  actor_type text NOT NULL DEFAULT 'user',
  actor_id uuid,
  rules_evaluated jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.core_policy_checks TO authenticated;
GRANT ALL ON public.core_policy_checks TO service_role;

ALTER TABLE public.core_policy_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read workspace policy checks"
  ON public.core_policy_checks FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE INDEX IF NOT EXISTS core_policy_checks_ws_created_idx
  ON public.core_policy_checks (workspace_id, created_at DESC);