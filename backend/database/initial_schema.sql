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
  created_at timestamptz default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null default 'nus',

  title text not null,
  description text not null,

  category text not null check (
    category in (
      'internship',
      'competition',
      'research',
      'exchange',
      'summer_programme',
      'winter_programme',
      'volunteer',
      'mentorship',
      'networking',
      'entrepreneurship',
      'other'
    )
  ),

  organisation text,
  source_url text,
  eligibility text,

  year_min integer check (year_min between 1 and 4),
  year_max integer check (year_max between 1 and 4),

  -- lowercase slugs; empty array = open to all majors
  eligible_majors text[] default '{}',

  delivery_mode text not null default 'unspecified' check (
    delivery_mode in ('online', 'hybrid', 'in_person', 'unspecified')
  ),
  -- venue or campus name; null when not applicable (e.g. fully online)
  location text,
  deadline timestamptz,

  created_at timestamptz default now(),

  constraint opportunities_year_range_valid check (year_min <= year_max)
);

create table public.saved_opportunities (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  created_at timestamptz default now(),

  primary key (user_id, opportunity_id)
);

create table public.opportunity_candidates (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null default 'nus',

  source_type text not null,
  source_message_id text,
  source_url text,
  raw_subject text,
  raw_sender text,
  received_at timestamptz,
  candidate_score integer not null default 0,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),

  -- Stores the parsed opportunity fields before an admin/user approves it.
  extracted_opportunity jsonb not null,

  created_at timestamptz default now(),

  unique (source_type, source_message_id)
);

alter table public.majors enable row level security;
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.opportunity_candidates enable row level security;

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

create policy "Anyone can view opportunities"
on public.opportunities
for select
to anon, authenticated
using (true);

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

insert into public.opportunities (
  title,
  description,
  category,
  organisation,
  source_url,
  eligibility,
  year_min,
  year_max,
  eligible_majors,
  delivery_mode,
  location,
  deadline
)
values
(
  'Software Engineering Internship',
  'A practical internship for students interested in software development, web applications, backend systems, and real-world engineering projects.',
  'internship',
  'Tech Career Office',
  'https://example.com/software-engineering-internship',
  'Basic programming knowledge recommended.',
  1,
  4,
  array['computer_science', 'engineering', 'business_artificial_intelligence_systems'],
  'hybrid',
  null,
  now() + interval '40 days'
),
(
  'University Innovation Competition',
  'A student competition where individuals or teams propose innovative solutions to real-world problems.',
  'competition',
  'Innovation Centre',
  'https://example.com/university-innovation-competition',
  'Open to all students.',
  1,
  4,
  '{}',
  'in_person',
  'On campus',
  now() + interval '25 days'
),
(
  'AI Research Assistant Programme',
  'A research opportunity for students interested in artificial intelligence, machine learning, data analysis, and academic research.',
  'research',
  'School of Computing',
  'https://example.com/ai-research-assistant-programme',
  'Basic Python knowledge recommended.',
  1,
  4,
  array['computer_science', 'data_science_and_analytics', 'mathematics'],
  'in_person',
  'School of Computing',
  now() + interval '30 days'
),
(
  'Global Exchange Information Session',
  'An information session about overseas exchange programmes, eligibility, application timelines, partner universities, and scholarship options.',
  'exchange',
  'International Office',
  'https://example.com/global-exchange-information-session',
  'Recommended for year 1 and year 2 students.',
  1,
  2,
  '{}',
  'online',
  null,
  now() + interval '21 days'
),
(
  'Summer Entrepreneurship Programme',
  'A summer programme for students who want to develop startup ideas, learn business validation, and pitch ideas to mentors.',
  'summer_programme',
  'Entrepreneurship Centre',
  'https://example.com/summer-entrepreneurship-programme',
  'Open to students interested in startups, innovation, or business.',
  1,
  4,
  array['business_administration', 'computer_science', 'engineering'],
  'in_person',
  'On campus',
  now() + interval '60 days'
),
(
  'Winter Data Science Bootcamp',
  'A winter programme teaching students basic data analysis, Python, data visualization, and introductory machine learning concepts.',
  'winter_programme',
  'Data Science Club',
  'https://example.com/winter-data-science-bootcamp',
  'No prior data science experience required.',
  1,
  4,
  array['computer_science', 'data_science_and_analytics', 'business_analytics'],
  'online',
  null,
  now() + interval '75 days'
),
(
  'Community Volunteer Programme',
  'A volunteering opportunity where students support local community projects, social impact initiatives, and charity events.',
  'volunteer',
  'Student Volunteer Office',
  'https://example.com/community-volunteer-programme',
  'Open to all students.',
  1,
  4,
  '{}',
  'in_person',
  'Local community centre',
  now() + interval '20 days'
),
(
  'Career Mentorship Programme',
  'A mentorship programme that connects students with seniors, alumni, and industry professionals for academic and career guidance.',
  'mentorship',
  'Career Development Office',
  'https://example.com/career-mentorship-programme',
  'Open to students seeking academic or career advice.',
  1,
  4,
  '{}',
  'hybrid',
  null,
  now() + interval '35 days'
),
(
  'Startup Networking Night',
  'A networking event where students can meet startup founders, investors, alumni, and entrepreneurship mentors.',
  'networking',
  'Entrepreneurship Centre',
  'https://example.com/startup-networking-night',
  'Open to all students.',
  1,
  4,
  '{}',
  'in_person',
  'Main Auditorium',
  now() + interval '14 days'
),
(
  'Student Founder Incubator',
  'An entrepreneurship programme for students who want to build, validate, and test early-stage startup ideas.',
  'entrepreneurship',
  'University Incubator',
  'https://example.com/student-founder-incubator',
  'Students should have a startup idea or strong interest in entrepreneurship.',
  1,
  4,
  array['business_administration', 'computer_science', 'engineering'],
  'in_person',
  'Innovation Lab',
  now() + interval '50 days'
),
(
  'Open Student Opportunity',
  'A general opportunity for students that does not fit into the main categories.',
  'other',
  'Student Affairs Office',
  'https://example.com/open-student-opportunity',
  'Open to all students.',
  1,
  4,
  '{}',
  'unspecified',
  null,
  now() + interval '28 days'
);

create index opportunities_category_idx
on public.opportunities(category);

create index opportunities_school_slug_idx
on public.opportunities(school_slug);

create index opportunities_delivery_mode_idx
on public.opportunities(delivery_mode);

create index opportunities_deadline_idx
on public.opportunities(deadline);

create index opportunities_year_min_idx
on public.opportunities(year_min);

create index opportunities_year_max_idx
on public.opportunities(year_max);

create index saved_opportunities_user_id_idx
on public.saved_opportunities(user_id);

create index opportunity_candidates_status_idx
on public.opportunity_candidates(status);

create index opportunity_candidates_school_slug_idx
on public.opportunity_candidates(school_slug);

create index opportunity_candidates_score_idx
on public.opportunity_candidates(candidate_score);
