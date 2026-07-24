create extension if not exists "pgcrypto";

-- Canonical values use lowercase slugs (e.g. computer_science).
-- Display labels belong in the frontend/API layer, not in the database.

create table public.majors (
  slug text primary key,
  label text not null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text not null default 'nus',
  faculty text,
  major text references public.majors(slug),
  year_of_study integer check (year_of_study between 1 and 4),
  opportunity_interests text[] not null default '{}' check (
    opportunity_interests <@ array[
      'internship',
      'competition',
      'scholarship',
      'research',
      'exchange',
      'summer_programme',
      'winter_programme',
      'volunteer',
      'community',
      'mentorship',
      'networking',
      'entrepreneurship',
      'other'
    ]::text[]
  ),
  career_goals text check (
    career_goals is null
    or char_length(btrim(career_goals)) between 1 and 1000
  ),
  skills_experience text check (
    skills_experience is null
    or char_length(btrim(skills_experience)) between 1 and 1500
  ),
  weekly_availability_hours integer check (
    weekly_availability_hours between 0 and 168
  ),
  workload_preference text check (
    workload_preference in ('light', 'moderate', 'intensive', 'flexible')
  ),
  opportunity_budget_sgd integer check (
    opportunity_budget_sgd between 0 and 100000
  ),
  preferred_locations text check (
    preferred_locations is null
    or char_length(btrim(preferred_locations)) between 1 and 300
  ),
  preferred_delivery_modes text[] not null default '{}' check (
    preferred_delivery_modes <@ array[
      'online',
      'hybrid',
      'in_person'
    ]::text[]
  ),
  willing_to_travel boolean,
  outlook_onboarding_status text not null default 'not_asked' check (
    outlook_onboarding_status in (
      'not_asked',
      'declined',
      'connected',
      'disconnected'
    )
  ),
  outlook_onboarding_updated_at timestamptz,
  created_at timestamptz default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, university)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'nus'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row
execute function public.create_profile_for_new_user();

-- Create profiles for users who existed before this schema was applied.
insert into public.profiles as existing_profile (id, full_name, university)
select
  auth_user.id,
  nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
  'nus'
from auth.users as auth_user
on conflict (id) do update
set full_name = coalesce(existing_profile.full_name, excluded.full_name);

revoke all on function public.create_profile_for_new_user()
from public, anon, authenticated;

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null default 'nus',
  source_priority integer not null default 99,
  visibility text not null default 'public' check (
    visibility in ('public', 'private')
  ),
  owner_user_id uuid references auth.users(id) on delete cascade,

  title text not null,
  description text not null,

  category text not null check (
    category in (
      'internship',
      'competition',
      'scholarship',
      'research',
      'exchange',
      'summer_programme',
      'winter_programme',
      'volunteer',
      'community',
      'mentorship',
      'networking',
      'entrepreneurship',
      'other'
    )
  ),

  organisation text,
  source_url text,
  application_url text,
  source_published_at timestamptz,
  last_seen_at timestamptz not null default now(),
  content_hash text,
  dedupe_key text,
  -- 0-100 completeness score copied from the approved crawler candidate.
  confidence_score integer not null default 0 check (
    confidence_score between 0 and 100
  ),
  eligibility text,

  year_min integer check (year_min between 1 and 4),
  year_max integer check (year_max between 1 and 4),
  year_eligibility_type text not null default 'unknown' check (
    year_eligibility_type in ('all', 'specific', 'inferred', 'unknown')
  ),

  -- Lowercase slugs. Use major_eligibility_type to interpret an empty array.
  eligible_majors text[] default '{}',
  major_eligibility_type text not null default 'unknown' check (
    major_eligibility_type in ('all', 'specific', 'inferred', 'unknown')
  ),

  delivery_mode text not null default 'unspecified' check (
    delivery_mode in ('online', 'hybrid', 'in_person', 'unspecified')
  ),
  -- venue or campus name; null when not applicable (e.g. fully online)
  location text,
  deadline timestamptz,
  -- UTC instant when the source provides an exact time and timezone.
  deadline_has_time boolean not null default false,
  deadline_source_timezone text,
  deadline_source_text text,
  -- The NUS deadline controls expiry when NUS and the host publish different dates.
  deadline_source text not null default 'unknown' check (
    deadline_source in ('nus', 'organiser', 'unknown')
  ),
  external_deadline timestamptz,
  external_deadline_has_time boolean not null default false,
  external_deadline_source_timezone text,
  external_deadline_source_text text,
  deadline_conflict boolean not null default false,
  deadline_note text,
  listing_expires_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint opportunities_year_range_valid check (year_min <= year_max),
  constraint opportunities_deadline_conflict_valid check (
    not deadline_conflict
    or (
      deadline_source = 'nus'
      and external_deadline is not null
      and deadline is distinct from external_deadline
    )
  )
);

create table public.saved_opportunities (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  created_at timestamptz default now(),

  primary key (user_id, opportunity_id)
);

create table public.study_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (
    format in ('summary', 'quiz', 'mock_exam')
  ),
  title text not null check (
    char_length(btrim(title)) between 1 and 200
  ),
  source_label text not null check (
    char_length(btrim(source_label)) between 1 and 300
  ),
  settings jsonb not null default '{}'::jsonb check (
    jsonb_typeof(settings) = 'object'
  ),
  output text not null check (char_length(btrim(output)) > 0),
  input_character_count integer not null check (
    input_character_count >= 30
  ),
  created_at timestamptz not null default now()
);

create table public.opportunity_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'incorrect_information',
      'already_expired',
      'suspicious_or_scam',
      'broken_application_link',
      'duplicate',
      'other'
    )
  ),
  details text check (
    details is null or char_length(btrim(details)) between 1 and 1000
  ),
  status text not null default 'pending' check (
    status in ('pending', 'reviewing', 'resolved', 'dismissed')
  ),
  resolution_notes text check (
    resolution_notes is null or char_length(btrim(resolution_notes)) between 1 and 1000
  ),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint opportunity_reports_other_details_required check (
    reason <> 'other' or details is not null
  )
);

create table public.opportunity_candidates (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null default 'nus',

  source_type text not null,
  source_message_id text,
  source_url text,
  application_url text,
  raw_subject text,
  raw_sender text,
  received_at timestamptz,
  source_published_at timestamptz,
  last_seen_at timestamptz not null default now(),
  content_hash text,
  source_priority integer not null default 99,
  visibility text not null default 'public' check (
    visibility in ('public', 'private')
  ),
  owner_user_id uuid references auth.users(id) on delete cascade,
  -- Keyword relevance decides whether text is a candidate at all.
  candidate_score integer not null default 0,
  -- Field completeness is separate from keyword relevance.
  confidence_score integer not null default 0 check (
    confidence_score between 0 and 100
  ),
  review_reasons text[] not null default '{}',
  dedupe_key text,
  extraction_evidence jsonb not null default '{}'::jsonb,
  auto_publish_eligible boolean not null default false,
  auto_publish_reasons text[] not null default '{}',
  listing_expires_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'expired')
  ),

  -- Stores the parsed opportunity fields before an admin/user approves it.
  extracted_opportunity jsonb not null,

  first_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  change_count integer not null default 0,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_at timestamptz default now(),

  unique (source_type, source_message_id)
);

create table public.opportunity_sources (
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

create table public.opportunity_candidate_versions (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.opportunity_candidates(id) on delete cascade,
  content_hash text,
  extracted_opportunity jsonb not null,
  recorded_at timestamptz not null default now()
);

create table public.crawler_runs (
  id uuid primary key default gen_random_uuid(),
  run_mode text not null,
  status text not null default 'running' check (
    status in ('running', 'completed', 'failed')
  ),
  scanned_count integer not null default 0,
  candidate_count integer not null default 0,
  active_count integer not null default 0,
  inserted_count integer not null default 0,
  refreshed_count integer not null default 0,
  changed_count integer not null default 0,
  auto_published_count integer not null default 0,
  source_results jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.majors enable row level security;
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.study_generations enable row level security;
alter table public.opportunity_reports enable row level security;
alter table public.opportunity_candidates enable row level security;
alter table public.opportunity_sources enable row level security;
alter table public.opportunity_candidate_versions enable row level security;
alter table public.crawler_runs enable row level security;

create policy "Anyone can view majors"
on public.majors
for select
to anon, authenticated
using (true);

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Anyone can view public opportunities"
on public.opportunities
for select
to anon, authenticated
using (visibility = 'public');

create policy "Users can view their private opportunities"
on public.opportunities
for select
to authenticated
using (
  visibility = 'private'
  and auth.uid() = owner_user_id
);

create policy "Users can view their own saved opportunities"
on public.saved_opportunities
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can save opportunities"
on public.saved_opportunities
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can remove their own saved opportunities"
on public.saved_opportunities
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own study generations"
on public.study_generations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can save their own study generations"
on public.study_generations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own study generations"
on public.study_generations
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own opportunity reports"
on public.opportunity_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);

create policy "Users can report visible opportunities"
on public.opportunity_reports
for insert
to authenticated
with check (
  auth.uid() = reporter_user_id
  and status = 'pending'
  and resolution_notes is null
  and resolved_at is null
  and exists (
    select 1
    from public.opportunities as opportunity
    where opportunity.id = opportunity_reports.opportunity_id
      and (
        opportunity.visibility = 'public'
        or opportunity.owner_user_id = auth.uid()
      )
  )
);

revoke all on public.opportunity_reports from anon;
grant select, insert on public.opportunity_reports to authenticated;

revoke all on public.study_generations from anon;
grant select, insert, delete on public.study_generations to authenticated;

-- Crawler writes should happen from trusted server-side code using the Supabase
-- service role key. No public read/write policy is added for candidates.

insert into public.majors (slug, label) values
  ('anthropology', 'Anthropology'),
  ('architecture', 'Architecture'),
  ('artificial_intelligence', 'Artificial Intelligence'),
  ('business_administration', 'Business Administration'),
  ('business_analytics', 'Business Analytics'),
  ('business_artificial_intelligence_systems', 'Business Artificial Intelligence Systems'),
  ('chemistry', 'Chemistry'),
  ('chinese_languages_and_cultures', 'Chinese Languages and Cultures'),
  ('chinese_studies_bilingual', 'Chinese Studies (Bilingual)'),
  ('common_computer_science_programmes', 'Common Computer Science Programmes'),
  ('communications_and_new_media', 'Communications and New Media'),
  ('computer_science', 'Computer Science'),
  ('data_science_and_analytics', 'Data Science and Analytics'),
  ('data_science_and_economics', 'Data Science and Economics'),
  ('economics', 'Economics'),
  ('engineering', 'Engineering'),
  ('english_language_and_linguistics', 'English Language and Linguistics'),
  ('english_literature', 'English Literature'),
  ('environmental_studies', 'Environmental Studies'),
  ('food_science_and_technology', 'Food Science and Technology'),
  ('geography', 'Geography'),
  ('geospatial_intelligence', 'Geospatial Intelligence'),
  ('global_studies', 'Global Studies'),
  ('history', 'History'),
  ('humanities_and_sciences', 'Humanities and Sciences'),
  ('industrial_design', 'Industrial Design'),
  ('information_security', 'Information Security'),
  ('infrastructure_and_project_management', 'Infrastructure and Project Management'),
  ('japanese_studies', 'Japanese Studies'),
  ('landscape_architecture', 'Landscape Architecture'),
  ('life_sciences', 'Life Sciences'),
  ('malay_studies', 'Malay Studies'),
  ('mathematics', 'Mathematics'),
  ('philosophy', 'Philosophy'),
  ('philosophy_politics_and_economics', 'Philosophy, Politics and Economics'),
  ('physics', 'Physics'),
  ('political_science', 'Political Science'),
  ('psychology', 'Psychology'),
  ('quantitative_finance', 'Quantitative Finance'),
  ('social_work', 'Social Work'),
  ('sociology', 'Sociology'),
  ('south_asian_studies', 'South Asian Studies'),
  ('southeast_asian_studies', 'Southeast Asian Studies'),
  ('statistics', 'Statistics'),
  ('theatre_and_performance_studies', 'Theatre and Performance Studies'),
  ('other', 'Other');

-- Production opportunities are added only by verified crawler or admin input.

create index opportunities_category_idx
on public.opportunities(category);

create index opportunities_school_slug_idx
on public.opportunities(school_slug);

create index opportunities_source_priority_idx
on public.opportunities(source_priority);

create index opportunities_visibility_owner_idx
on public.opportunities(visibility, owner_user_id);

create index opportunities_delivery_mode_idx
on public.opportunities(delivery_mode);

create index opportunities_deadline_idx
on public.opportunities(deadline);

create index opportunities_external_deadline_idx
on public.opportunities(external_deadline)
where external_deadline is not null;

create index opportunities_listing_expires_at_idx
on public.opportunities(listing_expires_at);

create index opportunities_last_seen_at_idx
on public.opportunities(last_seen_at);

create index opportunities_content_hash_idx
on public.opportunities(content_hash);

create unique index opportunities_dedupe_key_uidx
on public.opportunities(dedupe_key)
where dedupe_key is not null;

create index opportunities_year_min_idx
on public.opportunities(year_min);

create index opportunities_year_max_idx
on public.opportunities(year_max);

create index saved_opportunities_user_id_idx
on public.saved_opportunities(user_id);

create index study_generations_user_created_at_idx
on public.study_generations(user_id, created_at desc);

create index opportunity_reports_status_created_at_idx
on public.opportunity_reports(status, created_at);

create index opportunity_reports_opportunity_id_idx
on public.opportunity_reports(opportunity_id);

create unique index opportunity_reports_one_pending_per_user_idx
on public.opportunity_reports(opportunity_id, reporter_user_id)
where status in ('pending', 'reviewing');

create index opportunity_candidates_status_idx
on public.opportunity_candidates(status);

create index opportunity_candidates_school_slug_idx
on public.opportunity_candidates(school_slug);

create index opportunity_candidates_source_priority_idx
on public.opportunity_candidates(source_priority);

create index opportunity_candidates_visibility_owner_idx
on public.opportunity_candidates(visibility, owner_user_id);

create index opportunity_candidates_score_idx
on public.opportunity_candidates(candidate_score);

create index opportunity_candidates_confidence_score_idx
on public.opportunity_candidates(confidence_score);

create index opportunity_candidates_last_seen_at_idx
on public.opportunity_candidates(last_seen_at);

create index opportunity_candidates_content_hash_idx
on public.opportunity_candidates(content_hash);

create index opportunity_candidates_listing_expires_at_idx
on public.opportunity_candidates(listing_expires_at);

create index opportunity_candidates_dedupe_key_idx
on public.opportunity_candidates(dedupe_key);

create index opportunity_candidates_auto_publish_idx
on public.opportunity_candidates(auto_publish_eligible, status);

create index opportunity_sources_opportunity_id_idx
on public.opportunity_sources(opportunity_id);

create index opportunity_candidate_versions_candidate_id_idx
on public.opportunity_candidate_versions(candidate_id, recorded_at desc);

create index crawler_runs_started_at_idx
on public.crawler_runs(started_at desc);
