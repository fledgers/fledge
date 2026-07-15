-- One-time upgrade for projects created from the older three-table schema.
-- It preserves existing rows while adding the structures the crawler now needs.

create extension if not exists "pgcrypto";

create table if not exists public.majors (
  slug text primary key,
  label text not null
);

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
  ('other', 'Other')
on conflict (slug) do update set label = excluded.label;

alter table public.profiles
  alter column university set default 'nus';

update public.profiles
set university = 'nus'
where university is null;

alter table public.profiles
  alter column university set not null;

alter table public.profiles
  drop constraint if exists profiles_year_of_study_check;

alter table public.profiles
  add constraint profiles_year_of_study_check
  check (year_of_study between 1 and 4);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'public.majors'::regclass
  ) and not exists (
    select 1
    from public.profiles profile
    where profile.major is not null
      and not exists (
        select 1
        from public.majors major
        where major.slug = profile.major
      )
  ) then
    alter table public.profiles
      add constraint profiles_major_fkey
      foreign key (major) references public.majors(slug);
  end if;
end;
$$;

alter table public.opportunities
  add column if not exists school_slug text not null default 'nus',
  add column if not exists source_priority integer not null default 99,
  add column if not exists eligible_majors text[] not null default '{}',
  add column if not exists delivery_mode text not null default 'unspecified',
  add column if not exists deadline_has_time boolean not null default false,
  add column if not exists deadline_source_timezone text,
  add column if not exists deadline_source_text text;

alter table public.opportunities
  drop constraint if exists opportunities_category_check,
  drop constraint if exists opportunities_year_min_check,
  drop constraint if exists opportunities_year_max_check,
  drop constraint if exists opportunities_delivery_mode_check,
  drop constraint if exists opportunities_year_range_valid;

alter table public.opportunities
  add constraint opportunities_category_check
  check (category in (
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
  )),
  add constraint opportunities_year_min_check
  check (year_min between 1 and 4),
  add constraint opportunities_year_max_check
  check (year_max between 1 and 4),
  add constraint opportunities_delivery_mode_check
  check (delivery_mode in ('online', 'hybrid', 'in_person', 'unspecified')),
  add constraint opportunities_year_range_valid
  check (year_min <= year_max);

create table if not exists public.opportunity_candidates (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null default 'nus',
  source_type text not null,
  source_message_id text,
  source_url text,
  raw_subject text,
  raw_sender text,
  received_at timestamptz,
  source_priority integer not null default 99,
  candidate_score integer not null default 0,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'expired')
  ),
  extracted_opportunity jsonb not null,
  created_at timestamptz default now(),
  unique (source_type, source_message_id)
);

alter table public.majors enable row level security;
alter table public.opportunity_candidates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'majors'
      and policyname = 'Anyone can view majors'
  ) then
    create policy "Anyone can view majors"
    on public.majors
    for select
    to anon, authenticated
    using (true);
  end if;
end;
$$;

create index if not exists opportunities_category_idx
on public.opportunities(category);

create index if not exists opportunities_school_slug_idx
on public.opportunities(school_slug);

create index if not exists opportunities_source_priority_idx
on public.opportunities(source_priority);

create index if not exists opportunities_delivery_mode_idx
on public.opportunities(delivery_mode);

create index if not exists opportunities_deadline_idx
on public.opportunities(deadline);

create index if not exists opportunities_year_min_idx
on public.opportunities(year_min);

create index if not exists opportunities_year_max_idx
on public.opportunities(year_max);

create index if not exists opportunity_candidates_status_idx
on public.opportunity_candidates(status);

create index if not exists opportunity_candidates_school_slug_idx
on public.opportunity_candidates(school_slug);

create index if not exists opportunity_candidates_source_priority_idx
on public.opportunity_candidates(source_priority);

create index if not exists opportunity_candidates_score_idx
on public.opportunity_candidates(candidate_score);
