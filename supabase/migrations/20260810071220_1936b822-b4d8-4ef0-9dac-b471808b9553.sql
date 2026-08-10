CREATE TABLE public.closer_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.closer_profiles(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version)
);

GRANT SELECT, INSERT ON public.closer_profile_versions TO authenticated;
GRANT ALL ON public.closer_profile_versions TO service_role;

ALTER TABLE public.closer_profile_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members view profile versions" ON public.closer_profile_versions
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "workspace members write profile versions" ON public.closer_profile_versions
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE INDEX closer_profile_versions_profile_idx ON public.closer_profile_versions (profile_id, version DESC);