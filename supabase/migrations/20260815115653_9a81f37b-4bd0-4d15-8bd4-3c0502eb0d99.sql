create or replace function public.pause_lines_on_suppression()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.suppressed and not coalesce(old.suppressed, false) then
    update public.lead_lines
       set status = 'paused',
           updated_at = now()
     where contact_id = new.id
       and status = 'live';
  end if;
  return new;
end $$;

revoke execute on function public.pause_lines_on_suppression() from public;
revoke execute on function public.pause_lines_on_suppression() from anon;

drop trigger if exists contacts_pause_lines_on_suppression on public.contacts;
create trigger contacts_pause_lines_on_suppression
after update of suppressed on public.contacts
for each row execute function public.pause_lines_on_suppression();