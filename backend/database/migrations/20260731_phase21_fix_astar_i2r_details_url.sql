-- A*STAR moved the I2R Scientific Attachment information page.
-- Point the existing listing and its source metadata to the current page.
do $$
declare
  astar_i2r_title constant text := 'A*STAR I2R Scientific Attachment';
  astar_i2r_details_url constant text :=
    'https://www.a-star.edu.sg/i2r/JOIN-US/STUDENTS';
begin
  update public.opportunity_candidates
  set
    source_url = astar_i2r_details_url,
    extracted_opportunity = jsonb_set(
      jsonb_set(
        coalesce(extracted_opportunity, '{}'::jsonb),
        '{source_url}',
        to_jsonb(astar_i2r_details_url::text),
        true
      ),
      '{details_url}',
      to_jsonb(astar_i2r_details_url::text),
      true
    ),
    last_seen_at = now()
  where lower(coalesce(extracted_opportunity ->> 'title', raw_subject, ''))
    = lower(astar_i2r_title);

  update public.opportunities
  set
    source_url = astar_i2r_details_url,
    updated_at = now()
  where lower(title) = lower(astar_i2r_title);

  update public.opportunity_sources as source
  set
    source_url = astar_i2r_details_url,
    last_seen_at = now()
  where exists (
    select 1
    from public.opportunities as opportunity
    where opportunity.id = source.opportunity_id
      and lower(opportunity.title) = lower(astar_i2r_title)
  );
end;
$$;
