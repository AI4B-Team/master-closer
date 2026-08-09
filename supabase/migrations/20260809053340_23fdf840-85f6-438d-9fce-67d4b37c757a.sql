ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS wip_limit integer,
  ADD COLUMN IF NOT EXISTS stale_days integer NOT NULL DEFAULT 14;