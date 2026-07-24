alter table public.profiles
  add column if not exists opportunity_interests text[] not null default '{}',
  add column if not exists career_goals text,
  add column if not exists skills_experience text,
  add column if not exists weekly_availability_hours integer,
  add column if not exists workload_preference text,
  add column if not exists opportunity_budget_sgd integer,
  add column if not exists preferred_locations text,
  add column if not exists preferred_delivery_modes text[] not null default '{}',
  add column if not exists willing_to_travel boolean;

alter table public.profiles
  drop constraint if exists profiles_opportunity_interests_check,
  drop constraint if exists profiles_career_goals_length_check,
  drop constraint if exists profiles_skills_experience_length_check,
  drop constraint if exists profiles_weekly_availability_hours_check,
  drop constraint if exists profiles_workload_preference_check,
  drop constraint if exists profiles_opportunity_budget_sgd_check,
  drop constraint if exists profiles_preferred_locations_length_check,
  drop constraint if exists profiles_preferred_delivery_modes_check;

alter table public.profiles
  add constraint profiles_opportunity_interests_check
  check (
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
  add constraint profiles_career_goals_length_check
  check (
    career_goals is null
    or char_length(btrim(career_goals)) between 1 and 1000
  ),
  add constraint profiles_skills_experience_length_check
  check (
    skills_experience is null
    or char_length(btrim(skills_experience)) between 1 and 1500
  ),
  add constraint profiles_weekly_availability_hours_check
  check (
    weekly_availability_hours is null
    or weekly_availability_hours between 0 and 168
  ),
  add constraint profiles_workload_preference_check
  check (
    workload_preference is null
    or workload_preference in ('light', 'moderate', 'intensive', 'flexible')
  ),
  add constraint profiles_opportunity_budget_sgd_check
  check (
    opportunity_budget_sgd is null
    or opportunity_budget_sgd between 0 and 100000
  ),
  add constraint profiles_preferred_locations_length_check
  check (
    preferred_locations is null
    or char_length(btrim(preferred_locations)) between 1 and 300
  ),
  add constraint profiles_preferred_delivery_modes_check
  check (
    preferred_delivery_modes <@ array[
      'online',
      'hybrid',
      'in_person'
    ]::text[]
  );

comment on column public.profiles.skills_experience is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.weekly_availability_hours is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.workload_preference is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.opportunity_budget_sgd is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.preferred_locations is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.preferred_delivery_modes is
  'Optional private profile data used to improve opportunity recommendations.';

comment on column public.profiles.willing_to_travel is
  'Optional private profile data used to improve opportunity recommendations.';
