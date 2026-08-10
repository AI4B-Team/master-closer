CREATE TABLE public.objection_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.closer_profiles(id) ON DELETE SET NULL,
  industry text,
  prospect_text text NOT NULL,
  ai_response text NOT NULL,
  label text,
  mode text,
  occurrences integer NOT NULL DEFAULT 1,
  call_id uuid,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT objection_candidates_status_check CHECK (status IN ('pending','approved','dismissed'))
);

CREATE INDEX objection_candidates_workspace_idx ON public.objection_candidates (workspace_id, status, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objection_candidates TO authenticated;
GRANT ALL ON public.objection_candidates TO service_role;

ALTER TABLE public.objection_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read objection candidates"
  ON public.objection_candidates FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members create objection candidates"
  ON public.objection_candidates FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members update objection candidates"
  ON public.objection_candidates FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members delete objection candidates"
  ON public.objection_candidates FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER objection_candidates_updated_at
  BEFORE UPDATE ON public.objection_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();