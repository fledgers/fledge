create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text,
  faculty text,
  major text,
  year_of_study integer check (year_of_study between 1 and 6),
  interests text[] default '{}',
  created_at timestamptz default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),

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
    )
  ),

  organizer text,
  source_url text,
  eligibility text,

  year_min integer check (year_min between 1 and 6),
  year_max integer check (year_max between 1 and 6),

  interest_tags text[] default '{}',

  location text,
  deadline timestamptz,

  created_at timestamptz default now()
);

create table public.saved_opportunities (
  user_id uuid references auth.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  created_at timestamptz default now(),

  primary key (user_id, opportunity_id)
);

alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;

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

insert into public.opportunities (
  title,
  description,
  category,
  organizer,
  source_url,
  eligibility,
  year_min,
  year_max,
  interest_tags,
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
  array['software development', 'programming', 'technology', 'career'],
  'Hybrid',
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
  array['innovation', 'teamwork', 'problem solving', 'entrepreneurship'],
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
  array['artificial intelligence', 'machine learning', 'research', 'python'],
  'On campus',
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
  array['exchange', 'global', 'travel', 'international'],
  'Online',
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
  array['entrepreneurship', 'startup', 'business', 'innovation'],
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
  array['data science', 'python', 'machine learning', 'analytics'],
  'Online',
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
  array['volunteering', 'community', 'social impact', 'leadership'],
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
  array['mentorship', 'career', 'networking', 'guidance'],
  'Hybrid',
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
  array['entrepreneurship', 'networking', 'business', 'startup'],
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
  array['entrepreneurship', 'startup', 'business model', 'pitching'],
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
  array['general', 'student development', 'career'],
  'To be confirmed',
  now() + interval '28 days'
);

create index saved_opportunities_user_id_idx
on public.saved_opportunities(user_id);
