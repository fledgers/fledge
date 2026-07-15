alter table public.opportunities
add column if not exists application_url text,
add column if not exists source_published_at timestamptz,
add column if not exists last_seen_at timestamptz not null default now(),
add column if not exists content_hash text,
add column if not exists confidence_score integer not null default 0;

alter table public.opportunities
drop constraint if exists opportunities_confidence_score_check;

alter table public.opportunities
add constraint opportunities_confidence_score_check
check (confidence_score between 0 and 100);

alter table public.opportunity_candidates
add column if not exists application_url text,
add column if not exists source_published_at timestamptz,
add column if not exists last_seen_at timestamptz not null default now(),
add column if not exists content_hash text,
add column if not exists confidence_score integer not null default 0,
add column if not exists review_reasons text[] not null default '{}';

alter table public.opportunity_candidates
drop constraint if exists opportunity_candidates_confidence_score_check;

alter table public.opportunity_candidates
add constraint opportunity_candidates_confidence_score_check
check (confidence_score between 0 and 100);

create index if not exists opportunities_last_seen_at_idx
on public.opportunities(last_seen_at);

create index if not exists opportunities_content_hash_idx
on public.opportunities(content_hash);

create index if not exists opportunity_candidates_confidence_score_idx
on public.opportunity_candidates(confidence_score);

create index if not exists opportunity_candidates_last_seen_at_idx
on public.opportunity_candidates(last_seen_at);

create index if not exists opportunity_candidates_content_hash_idx
on public.opportunity_candidates(content_hash);

create or replace function public.approve_opportunity_candidate(candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.opportunity_candidates%rowtype;
  opportunity_data jsonb;
  approved_opportunity_id uuid;
begin
  select *
  into candidate
  from public.opportunity_candidates
  where id = candidate_id
  for update;

  if not found then
    raise exception 'Opportunity candidate % was not found.', candidate_id;
  end if;

  if candidate.status <> 'pending' then
    raise exception 'Opportunity candidate % is already %.', candidate_id, candidate.status;
  end if;

  opportunity_data := candidate.extracted_opportunity;

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
    confidence_score,
    eligibility,
    year_min,
    year_max,
    eligible_majors,
    delivery_mode,
    location,
    deadline,
    deadline_has_time,
    deadline_source_timezone,
    deadline_source_text
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
    coalesce(
      nullif(opportunity_data ->> 'confidence_score', '')::integer,
      candidate.confidence_score,
      0
    ),
    nullif(opportunity_data ->> 'eligibility', ''),
    nullif(opportunity_data ->> 'year_min', '')::integer,
    nullif(opportunity_data ->> 'year_max', '')::integer,
    coalesce(
      array(select jsonb_array_elements_text(coalesce(opportunity_data -> 'eligible_majors', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce(nullif(opportunity_data ->> 'delivery_mode', ''), 'unspecified'),
    nullif(opportunity_data ->> 'location', ''),
    nullif(opportunity_data ->> 'deadline', '')::timestamptz,
    coalesce((opportunity_data ->> 'deadline_has_time')::boolean, false),
    nullif(opportunity_data ->> 'deadline_source_timezone', ''),
    nullif(opportunity_data ->> 'deadline_source_text', '')
  )
  returning id into approved_opportunity_id;

  update public.opportunity_candidates
  set status = 'approved'
  where id = candidate_id;

  return approved_opportunity_id;
end;
$$;

revoke all on function public.approve_opportunity_candidate(uuid) from public, anon, authenticated;
grant execute on function public.approve_opportunity_candidate(uuid) to service_role;
