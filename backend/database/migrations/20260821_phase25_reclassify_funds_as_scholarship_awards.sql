-- The scholarship category is displayed as "Scholarships & Awards" and also
-- contains grants and funds. Community and research remain programme types,
-- not descriptions of what an award supports.

update public.opportunity_candidates
set extracted_opportunity = jsonb_set(
  extracted_opportunity,
  '{category}',
  to_jsonb('scholarship'::text),
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
    '(grant (seminar|workshop|writing)|fund management|investment fund)';

update public.opportunities
set category = 'scholarship',
  updated_at = now()
where category in ('community', 'research', 'other')
  and lower(title) ~
    '(^|[^a-z0-9])(grant|grants|fund|funds|funding)([^a-z0-9]|$)'
  and lower(title) !~
    '(grant (seminar|workshop|writing)|fund management|investment fund)';
