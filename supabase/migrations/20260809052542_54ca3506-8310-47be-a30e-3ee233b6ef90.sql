ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY org_id, stage ORDER BY updated_at DESC) AS rn
  FROM public.deals
)
UPDATE public.deals d SET sort_order = r.rn FROM ranked r WHERE r.id = d.id;