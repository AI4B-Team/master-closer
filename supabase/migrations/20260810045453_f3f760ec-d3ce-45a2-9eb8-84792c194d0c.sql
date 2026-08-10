DELETE FROM public.tasks WHERE title ILIKE '%QA smoke%';
DELETE FROM public.calls WHERE summary ILIKE '%QA smoke%';
DELETE FROM public.calls WHERE started_at > now() - interval '3 hours' AND lead_id IS NULL AND campaign_id IS NULL AND agent_id IS NULL;