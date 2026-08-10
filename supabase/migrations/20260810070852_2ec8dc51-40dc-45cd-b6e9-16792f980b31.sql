CREATE TABLE public.agent_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  proposal_id uuid REFERENCES public.agent_proposals(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

GRANT SELECT, INSERT ON public.agent_prompt_versions TO authenticated;
GRANT ALL ON public.agent_prompt_versions TO service_role;

ALTER TABLE public.agent_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view prompt versions" ON public.agent_prompt_versions
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "workspace members write prompt versions" ON public.agent_prompt_versions
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE INDEX agent_prompt_versions_agent_idx ON public.agent_prompt_versions (agent_id, version DESC);