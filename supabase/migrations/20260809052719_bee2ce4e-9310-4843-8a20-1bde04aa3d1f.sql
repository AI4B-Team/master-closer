CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage pipeline stages"
  ON public.pipeline_stages FOR ALL TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

INSERT INTO public.pipeline_stages (org_id, label, position, kind)
SELECT o.id, d.label, d.position, d.kind
FROM public.organizations o
CROSS JOIN (VALUES
  ('New', 1, 'open'),
  ('Qualifying', 2, 'open'),
  ('Proposal', 3, 'open'),
  ('Negotiation', 4, 'open'),
  ('Won', 5, 'won'),
  ('Lost', 6, 'lost')
) AS d(label, position, kind);

UPDATE public.deals dl
SET stage_id = ps.id
FROM public.pipeline_stages ps
WHERE ps.org_id = dl.org_id
  AND lower(ps.label) = CASE dl.stage::text
    WHEN 'new' THEN 'new'
    WHEN 'qualifying' THEN 'qualifying'
    WHEN 'proposal' THEN 'proposal'
    WHEN 'negotiation' THEN 'negotiation'
    WHEN 'won' THEN 'won'
    WHEN 'lost' THEN 'lost'
  END
  AND dl.stage_id IS NULL;