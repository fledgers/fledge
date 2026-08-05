-- The official page used by this listing now returns 404 and no current
-- replacement could be verified. Remove the stale listing rather than direct
-- students to unavailable information.

delete from public.opportunity_sources as source
where exists (
  select 1
  from public.opportunities as opportunity
  where opportunity.id = source.opportunity_id
    and lower(opportunity.title) =
      lower('A*STAR I2R Scientific Attachment')
);

delete from public.opportunity_candidates
where lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) =
  lower('A*STAR I2R Scientific Attachment');

delete from public.opportunities
where lower(title) = lower('A*STAR I2R Scientific Attachment');
