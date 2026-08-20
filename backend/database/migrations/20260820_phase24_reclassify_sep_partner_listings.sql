-- SEP partner information sheets describe coursework-based student exchange.
-- Their text can mention a host university's research or internship offerings,
-- which older crawler logic incorrectly treated as the primary programme type.

update public.opportunity_candidates
set extracted_opportunity = jsonb_set(
  extracted_opportunity,
  '{category}',
  to_jsonb('exchange'::text),
  true
)
where lower(coalesce(extracted_opportunity ->> 'category', '')) <> 'exchange'
  and lower(coalesce(
    extracted_opportunity ->> 'source_url',
    source_url,
    ''
  )) like '%/gro/docs/default-source/prog/sep/%';

update public.opportunities
set category = 'exchange',
  updated_at = now()
where category <> 'exchange'
  and lower(coalesce(source_url, '')) like
    '%/gro/docs/default-source/prog/sep/%';
