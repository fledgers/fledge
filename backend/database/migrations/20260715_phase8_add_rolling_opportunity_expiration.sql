alter table public.opportunities
add column if not exists listing_expires_at timestamptz;

alter table public.opportunity_candidates
add column if not exists listing_expires_at timestamptz;

-- Existing rolling records receive one fixed 60-day window based on when the
-- crawler first saw them. Re-running the crawler must not restart this window.
update public.opportunity_candidates
set
  listing_expires_at = coalesce(first_seen_at, created_at, now())
    + interval '60 days',
  extracted_opportunity = jsonb_set(
    extracted_opportunity,
    '{listing_expires_at}',
    to_jsonb(
      coalesce(first_seen_at, created_at, now()) + interval '60 days'
    ),
    true
  )
where nullif(extracted_opportunity ->> 'deadline', '') is null
  and coalesce(
    nullif(extracted_opportunity ->> 'application_url', ''),
    nullif(application_url, '')
  ) ~* '^https?://'
  and listing_expires_at is null;

update public.opportunities
set listing_expires_at = coalesce(created_at, now()) + interval '60 days'
where deadline is null
  and nullif(application_url, '') ~* '^https?://'
  and listing_expires_at is null;

create or replace function public.set_candidate_rolling_expiration()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  candidate_deadline timestamptz;
  candidate_application_url text;
  previous_was_rolling boolean := false;
begin
  candidate_deadline := nullif(
    new.extracted_opportunity ->> 'deadline',
    ''
  )::timestamptz;
  candidate_application_url := coalesce(
    nullif(new.extracted_opportunity ->> 'application_url', ''),
    nullif(new.application_url, '')
  );

  if tg_op = 'UPDATE' then
    previous_was_rolling := old.listing_expires_at is not null
      and nullif(old.extracted_opportunity ->> 'deadline', '') is null
      and coalesce(
        nullif(old.extracted_opportunity ->> 'application_url', ''),
        nullif(old.application_url, '')
      ) ~* '^https?://';
  end if;

  if candidate_deadline is not null
    or candidate_application_url is null
    or candidate_application_url !~* '^https?://'
  then
    new.listing_expires_at := null;
  elsif previous_was_rolling then
    new.listing_expires_at := old.listing_expires_at;
  elsif tg_op = 'INSERT' then
    new.listing_expires_at := coalesce(
      new.first_seen_at,
      new.created_at,
      now()
    ) + interval '60 days';
  else
    -- A dated opportunity can later become rolling. Start a new fixed window
    -- when that transition is first observed.
    new.listing_expires_at := now() + interval '60 days';
  end if;

  new.extracted_opportunity := jsonb_set(
    new.extracted_opportunity,
    '{listing_expires_at}',
    coalesce(to_jsonb(new.listing_expires_at), 'null'::jsonb),
    true
  );

  return new;
end;
$$;

drop trigger if exists opportunity_candidate_rolling_expiration_trigger
on public.opportunity_candidates;

create trigger opportunity_candidate_rolling_expiration_trigger
before insert or update of application_url, extracted_opportunity
on public.opportunity_candidates
for each row
execute function public.set_candidate_rolling_expiration();

create index if not exists opportunities_listing_expires_at_idx
on public.opportunities(listing_expires_at);

create index if not exists opportunity_candidates_listing_expires_at_idx
on public.opportunity_candidates(listing_expires_at);

create or replace function public.opportunity_is_active(
  deadline_at timestamptz,
  has_exact_time boolean,
  source_timezone text,
  rolling_expires_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when deadline_at is not null then public.opportunity_deadline_is_active(
      deadline_at,
      has_exact_time,
      source_timezone
    )
    when rolling_expires_at is not null then rolling_expires_at >= now()
    else false
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
    and not public.opportunity_is_active(
      nullif(extracted_opportunity ->> 'deadline', '')::timestamptz,
      coalesce((extracted_opportunity ->> 'deadline_has_time')::boolean, false),
      nullif(extracted_opportunity ->> 'deadline_source_timezone', ''),
      listing_expires_at
    );

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- The old view predates visibility and rolling-expiry columns. Recreate it so
-- its public shape includes the current opportunities table columns.
drop view if exists public.active_opportunities;

create view public.active_opportunities
with (security_invoker = true)
as
select *
from public.opportunities
where public.opportunity_is_active(
  deadline,
  deadline_has_time,
  deadline_source_timezone,
  listing_expires_at
);

create or replace function public.crawler_publish_candidate(
  candidate_id uuid,
  required_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_visibility text;
  candidate_owner_user_id uuid;
  candidate_application_url text;
  candidate_deadline timestamptz;
  candidate_deadline_has_time boolean;
  candidate_deadline_timezone text;
  candidate_listing_expires_at timestamptz;
  published_opportunity_id uuid;
begin
  select
    visibility,
    owner_user_id,
    coalesce(
      nullif(extracted_opportunity ->> 'application_url', ''),
      nullif(application_url, '')
    ),
    nullif(extracted_opportunity ->> 'deadline', '')::timestamptz,
    coalesce((extracted_opportunity ->> 'deadline_has_time')::boolean, false),
    nullif(extracted_opportunity ->> 'deadline_source_timezone', ''),
    listing_expires_at
  into
    candidate_visibility,
    candidate_owner_user_id,
    candidate_application_url,
    candidate_deadline,
    candidate_deadline_has_time,
    candidate_deadline_timezone,
    candidate_listing_expires_at
  from public.opportunity_candidates
  where id = candidate_id;

  if not found then
    raise exception 'Opportunity candidate % was not found.', candidate_id;
  end if;

  if candidate_visibility = 'private' and candidate_owner_user_id is null then
    raise exception
      'Private Outlook candidate % has no owner. Set OUTLOOK_OWNER_USER_ID and crawl again.',
      candidate_id;
  end if;

  if candidate_deadline is null
    and (
      candidate_application_url is null
      or candidate_application_url !~* '^https?://'
    )
  then
    raise exception
      'Candidate % has neither a deadline nor a usable application URL.',
      candidate_id;
  end if;

  if not public.opportunity_is_active(
    candidate_deadline,
    candidate_deadline_has_time,
    candidate_deadline_timezone,
    candidate_listing_expires_at
  ) then
    raise exception 'Opportunity candidate % has expired.', candidate_id;
  end if;

  published_opportunity_id := public.crawler_publish_candidate_data(
    candidate_id,
    required_status
  );

  update public.opportunities
  set
    visibility = candidate_visibility,
    owner_user_id = case
      when candidate_visibility = 'private' then candidate_owner_user_id
      else null
    end,
    listing_expires_at = case
      when candidate_deadline is null then candidate_listing_expires_at
      else null
    end,
    updated_at = now()
  where id = published_opportunity_id;

  return published_opportunity_id;
end;
$$;

create or replace function public.auto_publish_opportunity_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  published_count integer := 0;
  failed_count integer := 0;
begin
  for candidate in
    select id
    from public.opportunity_candidates
    where status = 'pending'
      and source_type = 'public_web'
      and auto_publish_eligible
      and public.opportunity_is_active(
        nullif(extracted_opportunity ->> 'deadline', '')::timestamptz,
        coalesce((extracted_opportunity ->> 'deadline_has_time')::boolean, false),
        nullif(extracted_opportunity ->> 'deadline_source_timezone', ''),
        listing_expires_at
      )
    order by source_priority, confidence_score desc, created_at
  loop
    begin
      perform public.crawler_publish_candidate(candidate.id, 'pending');
      published_count := published_count + 1;
    exception when others then
      failed_count := failed_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'published', published_count,
    'failed', failed_count
  );
end;
$$;

create or replace function public.sync_approved_opportunity_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  synced_count integer := 0;
  failed_count integer := 0;
begin
  for candidate in
    select candidate_row.id
    from public.opportunity_candidates as candidate_row
    left join public.opportunities as opportunity
      on opportunity.id = candidate_row.opportunity_id
    where candidate_row.status = 'approved'
      and public.opportunity_is_active(
        nullif(candidate_row.extracted_opportunity ->> 'deadline', '')::timestamptz,
        coalesce(
          (candidate_row.extracted_opportunity ->> 'deadline_has_time')::boolean,
          false
        ),
        nullif(
          candidate_row.extracted_opportunity ->> 'deadline_source_timezone',
          ''
        ),
        candidate_row.listing_expires_at
      )
      and (
        candidate_row.opportunity_id is null
        or opportunity.id is null
        or opportunity.content_hash is distinct from candidate_row.content_hash
        or opportunity.dedupe_key is distinct from candidate_row.dedupe_key
        or opportunity.visibility is distinct from candidate_row.visibility
        or opportunity.owner_user_id is distinct from candidate_row.owner_user_id
        or opportunity.listing_expires_at is distinct from candidate_row.listing_expires_at
        or not exists (
          select 1
          from public.opportunity_sources as source
          where source.source_type = candidate_row.source_type
            and source.source_message_id = candidate_row.source_message_id
        )
      )
  loop
    begin
      perform public.crawler_publish_candidate(candidate.id, 'approved');
      synced_count := synced_count + 1;
    exception when others then
      failed_count := failed_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'synced', synced_count,
    'failed', failed_count
  );
end;
$$;

revoke all on function public.set_candidate_rolling_expiration()
from public, anon, authenticated;

revoke all on function public.expire_past_opportunity_candidates()
from public, anon, authenticated;

revoke all on function public.crawler_publish_candidate(uuid, text)
from public, anon, authenticated;

revoke all on function public.auto_publish_opportunity_candidates()
from public, anon, authenticated;

revoke all on function public.sync_approved_opportunity_candidates()
from public, anon, authenticated;

grant execute on function public.expire_past_opportunity_candidates()
to service_role;

grant execute on function public.crawler_publish_candidate(uuid, text)
to service_role;

grant execute on function public.auto_publish_opportunity_candidates()
to service_role;

grant execute on function public.sync_approved_opportunity_candidates()
to service_role;

grant select on public.active_opportunities to anon, authenticated;

select public.expire_past_opportunity_candidates();
