-- Funds and grants provide money for a project. "Community" and "research"
-- may describe their subject matter, but are not the opportunity mechanism.

alter table public.opportunities
  drop constraint if exists opportunities_category_check;

alter table public.opportunities
  add constraint opportunities_category_check
  check (category in (
    'internship',
    'competition',
    'scholarship',
    'funding',
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
  ));

alter table public.profiles
  drop constraint if exists profiles_opportunity_interests_check;

alter table public.profiles
  add constraint profiles_opportunity_interests_check
  check (
    opportunity_interests <@ array[
      'internship',
      'competition',
      'scholarship',
      'funding',
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
  );

update public.opportunity_candidates
set extracted_opportunity = jsonb_set(
  extracted_opportunity,
  '{category}',
  to_jsonb('funding'::text),
  true
)
where lower(coalesce(extracted_opportunity ->> 'category', '')) in (
    'community',
    'research',
    'other'
  )
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) ~
    '(^|[^a-z0-9])(grant|grants|fund|funds|funding)([^a-z0-9]|$)'
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) !~
    '(^|[^a-z0-9])(scholarship|scholarships|bursary|bursaries)([^a-z0-9]|$)'
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) !~
    '(grant (seminar|workshop|writing)|fund management|investment fund)';

update public.opportunities
set category = 'funding',
  updated_at = now()
where category in ('community', 'research', 'other')
  and lower(title) ~
    '(^|[^a-z0-9])(grant|grants|fund|funds|funding)([^a-z0-9]|$)'
  and lower(title) !~
    '(^|[^a-z0-9])(scholarship|scholarships|bursary|bursaries)([^a-z0-9]|$)'
  and lower(title) !~
    '(grant (seminar|workshop|writing)|fund management|investment fund)';
