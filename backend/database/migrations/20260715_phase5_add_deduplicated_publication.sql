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
  candidate public.opportunity_candidates%rowtype;
  opportunity_data jsonb;
  target_opportunity public.opportunities%rowtype;
  target_opportunity_id uuid;
  candidate_dedupe_key text;
  should_replace boolean;
begin
  select *
  into candidate
  from public.opportunity_candidates
  where id = candidate_id
  for update;

  if not found then
    raise exception 'Opportunity candidate % was not found.', candidate_id;
  end if;

  if candidate.status <> required_status then
    raise exception 'Opportunity candidate % is %, expected %.',
      candidate_id,
      candidate.status,
      required_status;
  end if;

  opportunity_data := candidate.extracted_opportunity;
  candidate_dedupe_key := coalesce(
    candidate.dedupe_key,
    nullif(opportunity_data ->> 'dedupe_key', '')
  );

  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(candidate_dedupe_key, candidate.id::text), 0)
  );

  if candidate.opportunity_id is not null then
    select *
    into target_opportunity
    from public.opportunities
    where id = candidate.opportunity_id
    for update;
  elsif candidate_dedupe_key is not null then
    select *
    into target_opportunity
    from public.opportunities
    where dedupe_key = candidate_dedupe_key
    for update;
  end if;

  target_opportunity_id := target_opportunity.id;
  should_replace := target_opportunity_id is null
    or candidate.opportunity_id = target_opportunity_id
    or candidate.confidence_score >= target_opportunity.confidence_score;

  if target_opportunity_id is null then
    insert into public.opportunities (
      school_slug,
      source_priority,
      title,
      description,
      category,
      organisation,
      source_url,
      application_url,
      source_published_at,
      last_seen_at,
      content_hash,
      dedupe_key,
      confidence_score,
      eligibility,
      year_min,
      year_max,
      year_eligibility_type,
      eligible_majors,
      major_eligibility_type,
      delivery_mode,
      location,
      deadline,
      deadline_has_time,
      deadline_source_timezone,
      deadline_source_text,
      updated_at
    )
    values (
      coalesce(nullif(opportunity_data ->> 'school_slug', ''), candidate.school_slug),
      coalesce((opportunity_data ->> 'source_priority')::integer, candidate.source_priority),
      opportunity_data ->> 'title',
      opportunity_data ->> 'description',
      opportunity_data ->> 'category',
      nullif(opportunity_data ->> 'organisation', ''),
      coalesce(nullif(opportunity_data ->> 'source_url', ''), candidate.source_url),
      coalesce(nullif(opportunity_data ->> 'application_url', ''), candidate.application_url),
      coalesce(
        nullif(opportunity_data ->> 'source_published_at', '')::timestamptz,
        candidate.source_published_at
      ),
      coalesce(
        nullif(opportunity_data ->> 'last_seen_at', '')::timestamptz,
        candidate.last_seen_at,
        now()
      ),
      coalesce(nullif(opportunity_data ->> 'content_hash', ''), candidate.content_hash),
      candidate_dedupe_key,
      coalesce(
        nullif(opportunity_data ->> 'confidence_score', '')::integer,
        candidate.confidence_score,
        0
      ),
      nullif(opportunity_data ->> 'eligibility', ''),
      nullif(opportunity_data ->> 'year_min', '')::integer,
      nullif(opportunity_data ->> 'year_max', '')::integer,
      coalesce(nullif(opportunity_data ->> 'year_eligibility_type', ''), 'unknown'),
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(opportunity_data -> 'eligible_majors', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      ),
      coalesce(nullif(opportunity_data ->> 'major_eligibility_type', ''), 'unknown'),
      coalesce(nullif(opportunity_data ->> 'delivery_mode', ''), 'unspecified'),
      nullif(opportunity_data ->> 'location', ''),
      nullif(opportunity_data ->> 'deadline', '')::timestamptz,
      coalesce((opportunity_data ->> 'deadline_has_time')::boolean, false),
      nullif(opportunity_data ->> 'deadline_source_timezone', ''),
      nullif(opportunity_data ->> 'deadline_source_text', ''),
      now()
    )
    returning id into target_opportunity_id;
  elsif should_replace then
    update public.opportunities as existing_opportunity
    set
      school_slug = coalesce(
        nullif(opportunity_data ->> 'school_slug', ''),
        candidate.school_slug
      ),
      source_priority = coalesce(
        (opportunity_data ->> 'source_priority')::integer,
        candidate.source_priority
      ),
      title = opportunity_data ->> 'title',
      description = opportunity_data ->> 'description',
      category = opportunity_data ->> 'category',
      organisation = nullif(opportunity_data ->> 'organisation', ''),
      source_url = coalesce(
        nullif(opportunity_data ->> 'source_url', ''),
        candidate.source_url
      ),
      application_url = coalesce(
        nullif(opportunity_data ->> 'application_url', ''),
        candidate.application_url
      ),
      source_published_at = coalesce(
        nullif(opportunity_data ->> 'source_published_at', '')::timestamptz,
        candidate.source_published_at
      ),
      last_seen_at = greatest(
        existing_opportunity.last_seen_at,
        coalesce(
          nullif(opportunity_data ->> 'last_seen_at', '')::timestamptz,
          candidate.last_seen_at,
          now()
        )
      ),
      content_hash = coalesce(
        nullif(opportunity_data ->> 'content_hash', ''),
        candidate.content_hash
      ),
      dedupe_key = candidate_dedupe_key,
      confidence_score = coalesce(
        nullif(opportunity_data ->> 'confidence_score', '')::integer,
        candidate.confidence_score,
        0
      ),
      eligibility = nullif(opportunity_data ->> 'eligibility', ''),
      year_min = nullif(opportunity_data ->> 'year_min', '')::integer,
      year_max = nullif(opportunity_data ->> 'year_max', '')::integer,
      year_eligibility_type = coalesce(
        nullif(opportunity_data ->> 'year_eligibility_type', ''),
        'unknown'
      ),
      eligible_majors = coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(opportunity_data -> 'eligible_majors', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      ),
      major_eligibility_type = coalesce(
        nullif(opportunity_data ->> 'major_eligibility_type', ''),
        'unknown'
      ),
      delivery_mode = coalesce(
        nullif(opportunity_data ->> 'delivery_mode', ''),
        'unspecified'
      ),
      location = nullif(opportunity_data ->> 'location', ''),
      deadline = nullif(opportunity_data ->> 'deadline', '')::timestamptz,
      deadline_has_time = coalesce(
        (opportunity_data ->> 'deadline_has_time')::boolean,
        false
      ),
      deadline_source_timezone = nullif(
        opportunity_data ->> 'deadline_source_timezone',
        ''
      ),
      deadline_source_text = nullif(opportunity_data ->> 'deadline_source_text', ''),
      updated_at = now()
    where existing_opportunity.id = target_opportunity_id;
  else
    update public.opportunities
    set
      source_priority = least(source_priority, candidate.source_priority),
      last_seen_at = greatest(last_seen_at, candidate.last_seen_at),
      updated_at = now()
    where id = target_opportunity_id;
  end if;

  update public.opportunity_candidates
  set
    status = 'approved',
    opportunity_id = target_opportunity_id
  where id = candidate.id;

  insert into public.opportunity_sources (
    opportunity_id,
    candidate_id,
    source_type,
    source_message_id,
    source_url,
    application_url,
    content_hash,
    first_seen_at,
    last_seen_at
  )
  values (
    target_opportunity_id,
    candidate.id,
    candidate.source_type,
    candidate.source_message_id,
    candidate.source_url,
    candidate.application_url,
    candidate.content_hash,
    candidate.first_seen_at,
    candidate.last_seen_at
  )
  on conflict (source_type, source_message_id)
  do update set
    opportunity_id = excluded.opportunity_id,
    candidate_id = excluded.candidate_id,
    source_url = excluded.source_url,
    application_url = excluded.application_url,
    content_hash = excluded.content_hash,
    last_seen_at = greatest(
      opportunity_sources.last_seen_at,
      excluded.last_seen_at
    );

  return target_opportunity_id;
end;
$$;

create or replace function public.approve_opportunity_candidate(candidate_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.crawler_publish_candidate(candidate_id, 'pending');
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
      and public.opportunity_deadline_is_active(
        nullif(extracted_opportunity ->> 'deadline', '')::timestamptz,
        coalesce((extracted_opportunity ->> 'deadline_has_time')::boolean, false),
        nullif(extracted_opportunity ->> 'deadline_source_timezone', '')
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
      and (
        candidate_row.opportunity_id is null
        or opportunity.id is null
        or opportunity.content_hash is distinct from candidate_row.content_hash
        or opportunity.dedupe_key is distinct from candidate_row.dedupe_key
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

revoke all on function public.crawler_publish_candidate(uuid, text)
from public, anon, authenticated;

revoke all on function public.approve_opportunity_candidate(uuid)
from public, anon, authenticated;

revoke all on function public.auto_publish_opportunity_candidates()
from public, anon, authenticated;

revoke all on function public.sync_approved_opportunity_candidates()
from public, anon, authenticated;

grant execute on function public.approve_opportunity_candidate(uuid)
to service_role;

grant execute on function public.auto_publish_opportunity_candidates()
to service_role;

grant execute on function public.sync_approved_opportunity_candidates()
to service_role;
