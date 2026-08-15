DELETE FROM public.integrations i
USING public.integrations i2
WHERE i.workspace_id = i2.workspace_id
  AND i.provider = i2.provider
  AND (i.connected_at, i.id) < (i2.connected_at, i2.id);

ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_org_id_provider_key;

CREATE UNIQUE INDEX IF NOT EXISTS integrations_workspace_provider_key
  ON public.integrations (workspace_id, provider);