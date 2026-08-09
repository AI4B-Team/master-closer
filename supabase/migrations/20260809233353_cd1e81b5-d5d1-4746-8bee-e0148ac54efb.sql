update public.calls
   set outcome = 'failed',
       ended_at = coalesce(ended_at, started_at)
 where outcome = 'in_progress';