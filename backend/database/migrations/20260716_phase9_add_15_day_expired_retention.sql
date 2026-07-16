create or replace function public.opportunity_expired_at(
  deadline_at timestamptz,
  has_exact_time boolean,
  source_timezone text,
  rolling_expires_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when deadline_at is not null
      and has_exact_time
      and source_timezone is not null
      then deadline_at
    when deadline_at is not null then (
      ((deadline_at at time zone 'UTC')::date + 1)::timestamp
      at time zone 'Asia/Singapore'
    )
    else rolling_expires_at
  end;
$$;

create or replace function public.purge_expired_opportunities(
  retention_days integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_candidate_count integer := 0;
  deleted_opportunity_count integer := 0;
begin
  if retention_days < 0 then
    raise exception 'retention_days cannot be negative.';
  end if;

  delete from public.opportunity_candidates as candidate
  where (
    public.opportunity_expired_at(
      nullif(candidate.extracted_opportunity ->> 'deadline', '')::timestamptz,
      coalesce(
        (candidate.extracted_opportunity ->> 'deadline_has_time')::boolean,
        false
      ),
      nullif(
        candidate.extracted_opportunity ->> 'deadline_source_timezone',
        ''
      ),
      candidate.listing_expires_at
    ) + make_interval(days => retention_days)
  ) < now()
  or (
    nullif(candidate.extracted_opportunity ->> 'deadline', '') is null
    and candidate.listing_expires_at is null
    and coalesce(candidate.created_at, now())
      + make_interval(days => retention_days) < now()
  );

  get diagnostics deleted_candidate_count = row_count;

  delete from public.opportunities as opportunity
  where (
    public.opportunity_expired_at(
      opportunity.deadline,
      opportunity.deadline_has_time,
      opportunity.deadline_source_timezone,
      opportunity.listing_expires_at
    ) + make_interval(days => retention_days)
  ) < now()
  or (
    opportunity.deadline is null
    and opportunity.listing_expires_at is null
    and coalesce(opportunity.created_at, now())
      + make_interval(days => retention_days) < now()
  );

  get diagnostics deleted_opportunity_count = row_count;

  return jsonb_build_object(
    'retention_days', retention_days,
    'candidates_deleted', deleted_candidate_count,
    'opportunities_deleted', deleted_opportunity_count
  );
end;
$$;

revoke all on function public.purge_expired_opportunities(integer)
from public, anon, authenticated;

grant execute on function public.purge_expired_opportunities(integer)
to service_role;
