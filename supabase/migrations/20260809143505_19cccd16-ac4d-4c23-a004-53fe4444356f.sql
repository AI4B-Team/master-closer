ALTER TABLE public.agreement_templates ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.agreement_templates t
SET workspace_id = w.id
FROM public.workspaces w
WHERE t.workspace_id IS NULL
  AND w.org_id = t.org_id
  AND w.id = (SELECT w2.id FROM public.workspaces w2 WHERE w2.org_id = t.org_id ORDER BY w2.created_at ASC LIMIT 1);

CREATE INDEX IF NOT EXISTS agreement_templates_workspace_id_idx ON public.agreement_templates(workspace_id);

DROP POLICY IF EXISTS "org members manage templates" ON public.agreement_templates;

CREATE POLICY "workspace agreement templates all"
ON public.agreement_templates
FOR ALL
TO authenticated
USING (
  (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  OR (workspace_id IS NULL AND org_id = public.auth_org_id())
)
WITH CHECK (
  (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  OR (workspace_id IS NULL AND org_id = public.auth_org_id())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_templates TO authenticated;
GRANT ALL ON public.agreement_templates TO service_role;