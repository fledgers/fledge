-- "Common Computer Science Programmes" duplicates the canonical
-- "Computer Science" major. Move existing data before removing the old slug.

insert into public.majors (slug, label)
values ('computer_science', 'Computer Science')
on conflict (slug) do update
set label = excluded.label;

update public.profiles
set major = 'computer_science'
where major = 'common_computer_science_programmes';

update public.opportunities as opportunity
set eligible_majors = (
  select coalesce(
    array_agg(normalized.major_slug order by normalized.major_slug),
    '{}'::text[]
  )
  from (
    select distinct
      case
        when existing_major.major_slug = 'common_computer_science_programmes'
          then 'computer_science'
        else existing_major.major_slug
      end as major_slug
    from unnest(opportunity.eligible_majors)
      as existing_major(major_slug)
  ) as normalized
)
where 'common_computer_science_programmes' = any(opportunity.eligible_majors);

update public.opportunity_candidates as candidate
set extracted_opportunity = jsonb_set(
  candidate.extracted_opportunity,
  '{eligible_majors}',
  (
    select coalesce(
      jsonb_agg(normalized.major_slug order by normalized.major_slug),
      '[]'::jsonb
    )
    from (
      select distinct
        case
          when existing_major.major_slug = 'common_computer_science_programmes'
            then 'computer_science'
          else existing_major.major_slug
        end as major_slug
      from jsonb_array_elements_text(
        candidate.extracted_opportunity -> 'eligible_majors'
      ) as existing_major(major_slug)
    ) as normalized
  ),
  true
)
where jsonb_typeof(
    candidate.extracted_opportunity -> 'eligible_majors'
  ) = 'array'
  and (candidate.extracted_opportunity -> 'eligible_majors')
    ? 'common_computer_science_programmes';

delete from public.majors
where slug = 'common_computer_science_programmes';
