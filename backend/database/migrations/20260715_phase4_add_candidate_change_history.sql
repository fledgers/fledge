create or replace function public.ingest_opportunity_candidates(candidate_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_data jsonb;
  candidate_source_type text;
  candidate_source_message_id text;
  existing_candidate public.opportunity_candidates%rowtype;
  content_changed boolean;
  inserted_count integer := 0;
  refreshed_count integer := 0;
  changed_count integer := 0;
begin
  if candidate_rows is null or jsonb_typeof(candidate_rows) <> 'array' then
    raise exception 'candidate_rows must be a JSON array.';
  end if;

  for candidate_data in
    select value
    from jsonb_array_elements(candidate_rows)
  loop
    candidate_source_type := nullif(candidate_data ->> 'source_type', '');
    candidate_source_message_id := nullif(candidate_data ->> 'source_message_id', '');

    if candidate_source_type is null or candidate_source_message_id is null then
      raise exception 'Every candidate requires source_type and source_message_id.';
    end if;

    if coalesce(jsonb_typeof(candidate_data -> 'extracted_opportunity'), 'null') <> 'object' then
      raise exception 'Candidate % requires extracted_opportunity as a JSON object.',
        candidate_source_message_id;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(candidate_source_type || ':' || candidate_source_message_id, 0)
    );

    select *
    into existing_candidate
    from public.opportunity_candidates
    where source_type = candidate_source_type
      and source_message_id = candidate_source_message_id
    for update;

    if not found then
      insert into public.opportunity_candidates (
        school_slug,
        source_type,
        source_message_id,
        source_url,
        application_url,
        raw_subject,
        raw_sender,
        received_at,
        source_published_at,
        last_seen_at,
        content_hash,
        source_priority,
        candidate_score,
        confidence_score,
        review_reasons,
        dedupe_key,
        extraction_evidence,
        auto_publish_eligible,
        auto_publish_reasons,
        extracted_opportunity,
        first_seen_at,
        last_changed_at
      )
      values (
        coalesce(nullif(candidate_data ->> 'school_slug', ''), 'nus'),
        candidate_source_type,
        candidate_source_message_id,
        nullif(candidate_data ->> 'source_url', ''),
        nullif(candidate_data ->> 'application_url', ''),
        nullif(candidate_data ->> 'raw_subject', ''),
        nullif(candidate_data ->> 'raw_sender', ''),
        nullif(candidate_data ->> 'received_at', '')::timestamptz,
        nullif(candidate_data ->> 'source_published_at', '')::timestamptz,
        coalesce(nullif(candidate_data ->> 'last_seen_at', '')::timestamptz, now()),
        nullif(candidate_data ->> 'content_hash', ''),
        coalesce(nullif(candidate_data ->> 'source_priority', '')::integer, 99),
        coalesce(nullif(candidate_data ->> 'candidate_score', '')::integer, 0),
        coalesce(nullif(candidate_data ->> 'confidence_score', '')::integer, 0),
        case
          when jsonb_typeof(candidate_data -> 'review_reasons') = 'array'
            then array(
              select jsonb_array_elements_text(candidate_data -> 'review_reasons')
            )
          else '{}'::text[]
        end,
        nullif(candidate_data ->> 'dedupe_key', ''),
        coalesce(candidate_data -> 'extraction_evidence', '{}'::jsonb),
        coalesce((candidate_data ->> 'auto_publish_eligible')::boolean, false),
        case
          when jsonb_typeof(candidate_data -> 'auto_publish_reasons') = 'array'
            then array(
              select jsonb_array_elements_text(candidate_data -> 'auto_publish_reasons')
            )
          else '{}'::text[]
        end,
        candidate_data -> 'extracted_opportunity',
        coalesce(nullif(candidate_data ->> 'last_seen_at', '')::timestamptz, now()),
        coalesce(nullif(candidate_data ->> 'last_seen_at', '')::timestamptz, now())
      );

      inserted_count := inserted_count + 1;
      continue;
    end if;

    content_changed := existing_candidate.content_hash is distinct from
      nullif(candidate_data ->> 'content_hash', '');

    if content_changed then
      insert into public.opportunity_candidate_versions (
        candidate_id,
        content_hash,
        extracted_opportunity,
        recorded_at
      )
      values (
        existing_candidate.id,
        existing_candidate.content_hash,
        existing_candidate.extracted_opportunity,
        now()
      );

      changed_count := changed_count + 1;
    end if;

    update public.opportunity_candidates as existing
    set
      school_slug = coalesce(nullif(candidate_data ->> 'school_slug', ''), 'nus'),
      source_url = nullif(candidate_data ->> 'source_url', ''),
      application_url = nullif(candidate_data ->> 'application_url', ''),
      raw_subject = nullif(candidate_data ->> 'raw_subject', ''),
      raw_sender = nullif(candidate_data ->> 'raw_sender', ''),
      received_at = nullif(candidate_data ->> 'received_at', '')::timestamptz,
      source_published_at = nullif(
        candidate_data ->> 'source_published_at',
        ''
      )::timestamptz,
      last_seen_at = greatest(
        existing.last_seen_at,
        coalesce(nullif(candidate_data ->> 'last_seen_at', '')::timestamptz, now())
      ),
      content_hash = nullif(candidate_data ->> 'content_hash', ''),
      source_priority = coalesce(
        nullif(candidate_data ->> 'source_priority', '')::integer,
        99
      ),
      candidate_score = coalesce(
        nullif(candidate_data ->> 'candidate_score', '')::integer,
        0
      ),
      confidence_score = coalesce(
        nullif(candidate_data ->> 'confidence_score', '')::integer,
        0
      ),
      review_reasons = case
        when jsonb_typeof(candidate_data -> 'review_reasons') = 'array'
          then array(
            select jsonb_array_elements_text(candidate_data -> 'review_reasons')
          )
        else '{}'::text[]
      end,
      dedupe_key = nullif(candidate_data ->> 'dedupe_key', ''),
      extraction_evidence = coalesce(
        candidate_data -> 'extraction_evidence',
        '{}'::jsonb
      ),
      auto_publish_eligible = coalesce(
        (candidate_data ->> 'auto_publish_eligible')::boolean,
        false
      ),
      auto_publish_reasons = case
        when jsonb_typeof(candidate_data -> 'auto_publish_reasons') = 'array'
          then array(
            select jsonb_array_elements_text(candidate_data -> 'auto_publish_reasons')
          )
        else '{}'::text[]
      end,
      extracted_opportunity = candidate_data -> 'extracted_opportunity',
      last_changed_at = case
        when content_changed then now()
        else existing.last_changed_at
      end,
      change_count = existing.change_count + case when content_changed then 1 else 0 end
    where existing.id = existing_candidate.id;

    refreshed_count := refreshed_count + 1;
  end loop;

  return jsonb_build_object(
    'processed', inserted_count + refreshed_count,
    'inserted', inserted_count,
    'refreshed', refreshed_count,
    'changed', changed_count
  );
end;
$$;

revoke all on function public.ingest_opportunity_candidates(jsonb)
from public, anon, authenticated;

grant execute on function public.ingest_opportunity_candidates(jsonb)
to service_role;
