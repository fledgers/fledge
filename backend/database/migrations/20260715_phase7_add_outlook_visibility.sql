alter table public.opportunities
  add column if not exists visibility text not null default 'public',
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.opportunity_candidates
  add column if not exists visibility text not null default 'public',
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.opportunities
  drop constraint if exists opportunities_visibility_check,
  drop constraint if exists opportunities_private_owner_check;

alter table public.opportunities
  add constraint opportunities_visibility_check
  check (visibility in ('public', 'private')),
  add constraint opportunities_private_owner_check
  check (
    (visibility = 'public' and owner_user_id is null)
    or (visibility = 'private' and owner_user_id is not null)
  );

alter table public.opportunity_candidates
  drop constraint if exists opportunity_candidates_visibility_check;

alter table public.opportunity_candidates
  add constraint opportunity_candidates_visibility_check
  check (visibility in ('public', 'private'));

create or replace function public.set_candidate_visibility_from_payload()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  payload_owner text;
  previous_dedupe_key text;
begin
  previous_dedupe_key := case
    when tg_op = 'UPDATE' then old.dedupe_key
    else new.dedupe_key
  end;

  if new.source_type <> 'outlook_email' then
    new.visibility := 'public';
    new.owner_user_id := null;
  elsif coalesce(
    new.extracted_opportunity ->> 'major_eligibility_type',
    'unknown'
  ) = 'all' then
    new.visibility := 'public';
    new.owner_user_id := null;
  else
    new.visibility := 'private';
    payload_owner := nullif(
      new.extracted_opportunity ->> 'owner_user_id',
      ''
    );

    new.owner_user_id := case
      when payload_owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then payload_owner::uuid
      else null
    end;

    if new.dedupe_key is not null
      and new.dedupe_key not like 'private:%'
    then
      new.dedupe_key := 'private:'
        || coalesce(new.owner_user_id::text, 'unowned')
        || ':'
        || new.dedupe_key;
    end if;
  end if;

  new.extracted_opportunity := jsonb_set(
    jsonb_set(
      jsonb_set(
        new.extracted_opportunity,
        '{visibility}',
        to_jsonb(new.visibility),
        true
      ),
      '{owner_user_id}',
      coalesce(to_jsonb(new.owner_user_id), 'null'::jsonb),
      true
    ),
    '{dedupe_key}',
    coalesce(to_jsonb(new.dedupe_key), 'null'::jsonb),
    true
  );

  if tg_op = 'UPDATE'
    and previous_dedupe_key is distinct from new.dedupe_key
  then
    new.opportunity_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_candidate_visibility_trigger
on public.opportunity_candidates;

create trigger opportunity_candidate_visibility_trigger
before insert or update of source_type, dedupe_key, extracted_opportunity
on public.opportunity_candidates
for each row
execute function public.set_candidate_visibility_from_payload();

update public.opportunity_candidates
set
  dedupe_key = dedupe_key,
  extracted_opportunity = extracted_opportunity;

create index if not exists opportunities_visibility_owner_idx
on public.opportunities(visibility, owner_user_id);

create index if not exists opportunity_candidates_visibility_owner_idx
on public.opportunity_candidates(visibility, owner_user_id);

drop policy if exists "Anyone can view opportunities"
on public.opportunities;

drop policy if exists "Anyone can view public opportunities"
on public.opportunities;

drop policy if exists "Users can view their private opportunities"
on public.opportunities;

create policy "Anyone can view public opportunities"
on public.opportunities
for select
to anon, authenticated
using (visibility = 'public');

create policy "Users can view their private opportunities"
on public.opportunities
for select
to authenticated
using (
  visibility = 'private'
  and auth.uid() = owner_user_id
);

do $$
begin
  if to_regprocedure(
    'public.crawler_publish_candidate_data(uuid,text)'
  ) is null then
    alter function public.crawler_publish_candidate(uuid, text)
    rename to crawler_publish_candidate_data;
  end if;
end;
$$;

create or replace function public.crawler_publish_candidate(
  candidate_id uuid,
  required_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_visibility text;
  candidate_owner_user_id uuid;
  published_opportunity_id uuid;
begin
  select visibility, owner_user_id
  into candidate_visibility, candidate_owner_user_id
  from public.opportunity_candidates
  where id = candidate_id;

  if not found then
    raise exception 'Opportunity candidate % was not found.', candidate_id;
  end if;

  if candidate_visibility = 'private' and candidate_owner_user_id is null then
    raise exception
      'Private Outlook candidate % has no owner. Set OUTLOOK_OWNER_USER_ID and crawl again.',
      candidate_id;
  end if;

  published_opportunity_id := public.crawler_publish_candidate_data(
    candidate_id,
    required_status
  );

  update public.opportunities
  set
    visibility = candidate_visibility,
    owner_user_id = case
      when candidate_visibility = 'private' then candidate_owner_user_id
      else null
    end,
    updated_at = now()
  where id = published_opportunity_id;

  return published_opportunity_id;
end;
$$;

create or replace function public.approve_opportunity_candidate(candidate_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.crawler_publish_candidate(candidate_id, 'pending');
$$;

create or replace function public.sync_approved_opportunity_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  synced_count integer := 0;
  failed_count integer := 0;
begin
  for candidate in
    select candidate_row.id
    from public.opportunity_candidates as candidate_row
    left join public.opportunities as opportunity
      on opportunity.id = candidate_row.opportunity_id
    where candidate_row.status = 'approved'
      and (
        candidate_row.opportunity_id is null
        or opportunity.id is null
        or opportunity.content_hash is distinct from candidate_row.content_hash
        or opportunity.dedupe_key is distinct from candidate_row.dedupe_key
        or opportunity.visibility is distinct from candidate_row.visibility
        or opportunity.owner_user_id is distinct from candidate_row.owner_user_id
        or not exists (
          select 1
          from public.opportunity_sources as source
          where source.source_type = candidate_row.source_type
            and source.source_message_id = candidate_row.source_message_id
        )
      )
  loop
    begin
      perform public.crawler_publish_candidate(candidate.id, 'approved');
      synced_count := synced_count + 1;
    exception when others then
      failed_count := failed_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'synced', synced_count,
    'failed', failed_count
  );
end;
$$;

revoke all on function public.set_candidate_visibility_from_payload()
from public, anon, authenticated;

revoke all on function public.crawler_publish_candidate_data(uuid, text)
from public, anon, authenticated;

revoke all on function public.crawler_publish_candidate(uuid, text)
from public, anon, authenticated;

revoke all on function public.approve_opportunity_candidate(uuid)
from public, anon, authenticated;

revoke all on function public.sync_approved_opportunity_candidates()
from public, anon, authenticated;

grant execute on function public.crawler_publish_candidate(uuid, text)
to service_role;

grant execute on function public.approve_opportunity_candidate(uuid)
to service_role;

grant execute on function public.sync_approved_opportunity_candidates()
to service_role;
