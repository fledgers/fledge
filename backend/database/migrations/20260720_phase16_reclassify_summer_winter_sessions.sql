-- A programme page can mention scholarships or financial aid without being a
-- scholarship itself. Correct older records whose titles explicitly identify
-- them as summer or winter programmes, then let future crawls use the same
-- classification rule.

update public.opportunity_candidates
set extracted_opportunity = jsonb_set(
  extracted_opportunity,
  '{category}',
  to_jsonb(
    case
      when lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) ~
        '(^|[^a-z0-9])summer[[:space:]]+(session|programme|program|school|course)([^a-z0-9]|$)'
        then 'summer_programme'
      else 'winter_programme'
    end
  ),
  true
)
where lower(coalesce(extracted_opportunity ->> 'category', '')) = 'scholarship'
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) !~
    '(^|[^a-z0-9])(scholarship|bursary)([^a-z0-9]|$)'
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) ~
    '(^|[^a-z0-9])(summer|winter)[[:space:]]+(session|programme|program|school|course)([^a-z0-9]|$)';

update public.opportunities
set category = case
  when lower(title) ~
    '(^|[^a-z0-9])summer[[:space:]]+(session|programme|program|school|course)([^a-z0-9]|$)'
    then 'summer_programme'
  else 'winter_programme'
end,
updated_at = now()
where category = 'scholarship'
  and lower(title) !~ '(^|[^a-z0-9])(scholarship|bursary)([^a-z0-9]|$)'
  and lower(title) ~
    '(^|[^a-z0-9])(summer|winter)[[:space:]]+(session|programme|program|school|course)([^a-z0-9]|$)';
