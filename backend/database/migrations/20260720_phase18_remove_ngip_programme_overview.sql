-- NGIP's programme overview describes recurring future intakes, not a current
-- application opening. Remove the old crawler record; future pages are now
-- rejected unless they contain a current intake or a deadline.

delete from public.opportunity_candidates
where source_type = 'public_web'
  and lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) like
    'the nus global internship programme (ngip) allows students to gain practical experience%';

delete from public.opportunities
where lower(title) like
  'the nus global internship programme (ngip) allows students to gain practical experience%';
