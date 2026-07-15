alter table public.opportunities
  add column if not exists dedupe_key text,
  add column if not exists year_eligibility_type text not null default 'unknown',
  add column if not exists major_eligibility_type text not null default 'unknown',
  add column if not exists updated_at timestamptz not null default now();

alter table public.opportunities
  drop constraint if exists opportunities_year_eligibility_type_check,
  drop constraint if exists opportunities_major_eligibility_type_check;

alter table public.opportunities
  add constraint opportunities_year_eligibility_type_check
  check (year_eligibility_type in ('all', 'specific', 'inferred', 'unknown')),
  add constraint opportunities_major_eligibility_type_check
  check (major_eligibility_type in ('all', 'specific', 'inferred', 'unknown'));

alter table public.opportunity_candidates
  add column if not exists dedupe_key text,
  add column if not exists extraction_evidence jsonb not null default '{}'::jsonb,
  add column if not exists auto_publish_eligible boolean not null default false,
  add column if not exists auto_publish_reasons text[] not null default '{}',
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_changed_at timestamptz not null default now(),
  add column if not exists change_count integer not null default 0,
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

update public.opportunity_candidates
set
  first_seen_at = coalesce(created_at, now()),
  last_changed_at = coalesce(created_at, now())
where first_seen_at is null
   or last_changed_at is null;

update public.opportunity_candidates as candidate
set opportunity_id = opportunity.id
from public.opportunities as opportunity
where candidate.status = 'approved'
  and candidate.opportunity_id is null
  and (
    candidate.content_hash = opportunity.content_hash
    or candidate.source_url = opportunity.source_url
  );

create table if not exists public.opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  candidate_id uuid references public.opportunity_candidates(id) on delete set null,
  source_type text not null,
  source_message_id text not null,
  source_url text,
  application_url text,
  content_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_type, source_message_id)
);

create table if not exists public.opportunity_candidate_versions (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.opportunity_candidates(id) on delete cascade,
  content_hash text,
  extracted_opportunity jsonb not null,
  recorded_at timestamptz not null default now()
);

create unique index if not exists opportunities_dedupe_key_uidx
on public.opportunities(dedupe_key)
where dedupe_key is not null;

create index if not exists opportunity_candidates_dedupe_key_idx
on public.opportunity_candidates(dedupe_key);

create index if not exists opportunity_candidates_auto_publish_idx
on public.opportunity_candidates(auto_publish_eligible, status);

create index if not exists opportunity_sources_opportunity_id_idx
on public.opportunity_sources(opportunity_id);

create index if not exists opportunity_candidate_versions_candidate_id_idx
on public.opportunity_candidate_versions(candidate_id, recorded_at desc);

alter table public.opportunity_sources enable row level security;
alter table public.opportunity_candidate_versions enable row level security;

-- These tables contain crawler-only provenance. The service role can access
-- them, but no anon/authenticated policies are intentionally created.
