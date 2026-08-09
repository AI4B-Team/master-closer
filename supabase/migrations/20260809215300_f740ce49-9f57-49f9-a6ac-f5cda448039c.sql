CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  base text := 'https://project--e4a2e757-f7bb-4f36-9841-e1842c896b80.lovable.app';
  key  text := 'f4b565620b56d3cfd9bd543d47eda93d94f1d82c06d4c0be';
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
   WHERE jobname IN ('mc-agents-tick','mc-report-digests','mc-hub-dispatch');

  PERFORM cron.schedule('mc-agents-tick', '*/5 * * * *', format($f$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{}'::jsonb
    );
  $f$, base || '/api/public/agents/tick',
       json_build_object('Content-Type','application/json','x-cron-key',key)::text));

  PERFORM cron.schedule('mc-report-digests', '*/15 * * * *', format($f$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{}'::jsonb
    );
  $f$, base || '/api/public/reports/digest',
       json_build_object('Content-Type','application/json','x-cron-key',key)::text));

  PERFORM cron.schedule('mc-hub-dispatch', '*/10 * * * *', format($f$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{}'::jsonb
    );
  $f$, base || '/api/public/hub/dispatch',
       json_build_object('Content-Type','application/json','x-hub-secret',key)::text));
END $$;