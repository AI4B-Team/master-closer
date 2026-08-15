DO $$
DECLARE
  base text := 'https://project--e4a2e757-f7bb-4f36-9841-e1842c896b80.lovable.app';
  key  text := 'f4b565620b56d3cfd9bd543d47eda93d94f1d82c06d4c0be';
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'mc-core-suppression-sync';

  PERFORM cron.schedule('mc-core-suppression-sync', '23 * * * *', format($f$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{}'::jsonb
    );
  $f$, base || '/api/public/core/sync-suppressions',
       json_build_object('Content-Type','application/json','x-cron-key',key)::text));
END $$;