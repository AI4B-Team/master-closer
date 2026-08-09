ALTER TABLE public.agent_runs REPLICA IDENTITY FULL;
ALTER TABLE public.agent_proposals REPLICA IDENTITY FULL;
ALTER TABLE public.worklist_nominations REPLICA IDENTITY FULL;
ALTER TABLE public.background_agents REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worklist_nominations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.background_agents;