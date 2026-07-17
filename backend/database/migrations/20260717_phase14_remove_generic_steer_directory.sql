-- The STEER landing page is a directory, not one application opportunity.
-- Remove only the old directory-derived record so future crawls can publish
-- one record per linked STEER programme document.

delete from public.opportunity_candidates
where source_type = 'public_web'
  and source_message_id = (
    'nus-gro-steer:'
    || 'https://www.nus.edu.sg/gro/global-programmes/'
    || 'special-global-programmes/steer'
  );

delete from public.opportunities
where source_url = (
    'https://www.nus.edu.sg/gro/global-programmes/'
    || 'special-global-programmes/steer'
  )
  and lower(title) = lower(
    'Study Trips For Engagement & EnRichment (STEER)'
  );
