DELETE FROM public.disclosure_settings d
USING public.disclosure_settings d2
WHERE d.workspace_id = d2.workspace_id
  AND (d.updated_at, d.id) < (d2.updated_at, d2.id);

ALTER TABLE public.disclosure_settings
  DROP CONSTRAINT IF EXISTS disclosure_settings_org_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS disclosure_settings_workspace_id_key
  ON public.disclosure_settings (workspace_id);