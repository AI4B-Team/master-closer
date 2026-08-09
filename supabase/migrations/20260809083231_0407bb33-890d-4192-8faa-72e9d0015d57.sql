ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.agreements REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='deals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='agreements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agreements;
  END IF;
END $$;