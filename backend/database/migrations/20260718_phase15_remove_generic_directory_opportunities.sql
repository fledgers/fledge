-- Support pages and programme directories are useful crawler entry points,
-- but they are not application opportunities. Remove records created before
-- the crawler began rejecting these page types.

delete from public.opportunity_candidates
where source_type = 'public_web'
  and (
    lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) ~
      '^(apply now|application info(rmation)?|awards and scholarships|employment opportunities|faq|frequently asked questions|home( page)?|noc story|outgoing exchange(rs| students?)|partner universities( for exchange)?|returning exchange(rs| students?)|student exchange programme)([[:space:]]*[-|–—][[:space:]]*.*)?$'
    or lower(coalesce(extracted_opportunity ->> 'title', raw_subject, '')) ~
      '(^|[[:space:]])template([[:space:]]*[-|–—][[:space:]]*.*)?$'
    or lower(coalesce(source_url, '')) like '%/menu-templates/%'
  );

delete from public.opportunities
where (
    lower(title) ~
      '^(apply now|application info(rmation)?|awards and scholarships|employment opportunities|faq|frequently asked questions|home( page)?|noc story|outgoing exchange(rs| students?)|partner universities( for exchange)?|returning exchange(rs| students?)|student exchange programme)([[:space:]]*[-|–—][[:space:]]*.*)?$'
    or lower(title) ~
      '(^|[[:space:]])template([[:space:]]*[-|–—][[:space:]]*.*)?$'
    or lower(coalesce(source_url, '')) like '%/menu-templates/%'
  );
