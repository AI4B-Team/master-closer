create or replace function public.close_stale_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  with upd as (
    update public.calls
       set outcome = 'failed',
           ended_at = coalesce(ended_at, started_at),
           duration_sec = coalesce(nullif(duration_sec, 0), 0)
     where outcome = 'in_progress'
       and started_at < now() - interval '1 hour'
    returning 1
  )
  select count(*) into n from upd;
  return n;
end;
$$;

revoke all on function public.close_stale_calls() from public;
revoke all on function public.close_stale_calls() from anon, authenticated;
grant execute on function public.close_stale_calls() to service_role;

select public.close_stale_calls();

select cron.schedule('mc-close-stale-calls', '7 * * * *', $$select public.close_stale_calls();$$);