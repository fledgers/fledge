alter table public.opportunity_candidates
drop constraint if exists opportunity_candidates_status_check;

alter table public.opportunity_candidates
add constraint opportunity_candidates_status_check
check (status in ('pending', 'approved', 'rejected', 'expired'));

create or replace function public.opportunity_deadline_is_active(
  deadline_at timestamptz,
  has_exact_time boolean,
  source_timezone text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when deadline_at is null then true
    when has_exact_time and source_timezone is not null then deadline_at >= now()
    else (deadline_at at time zone 'UTC')::date >= (now() at time zone 'Asia/Singapore')::date
  end;
$$;

create or replace function public.expire_past_opportunity_candidates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.opportunity_candidates
  set status = 'expired'
  where status = 'pending'
    and not public.opportunity_deadline_is_active(
      nullif(extracted_opportunity ->> 'deadline', '')::timestamptz,
      coalesce((extracted_opportunity ->> 'deadline_has_time')::boolean, false),
      nullif(extracted_opportunity ->> 'deadline_source_timezone', '')
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace view public.active_opportunities
with (security_invoker = true)
as
select *
from public.opportunities
where public.opportunity_deadline_is_active(
  deadline,
  deadline_has_time,
  deadline_source_timezone
);

revoke all on function public.expire_past_opportunity_candidates() from public, anon, authenticated;
grant execute on function public.expire_past_opportunity_candidates() to service_role;
grant select on public.active_opportunities to anon, authenticated;
