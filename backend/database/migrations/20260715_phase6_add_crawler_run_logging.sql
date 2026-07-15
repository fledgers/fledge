create table if not exists public.crawler_runs (
  id uuid primary key default gen_random_uuid(),
  run_mode text not null,
  status text not null default 'running' check (
    status in ('running', 'completed', 'failed')
  ),
  scanned_count integer not null default 0,
  candidate_count integer not null default 0,
  active_count integer not null default 0,
  inserted_count integer not null default 0,
  refreshed_count integer not null default 0,
  changed_count integer not null default 0,
  auto_published_count integer not null default 0,
  source_results jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists crawler_runs_started_at_idx
on public.crawler_runs(started_at desc);

alter table public.crawler_runs enable row level security;

create or replace function public.start_crawler_run(run_mode text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  crawler_run_id uuid;
begin
  insert into public.crawler_runs (run_mode)
  values (coalesce(nullif(run_mode, ''), 'unknown'))
  returning id into crawler_run_id;

  return crawler_run_id;
end;
$$;

create or replace function public.finish_crawler_run(
  run_id uuid,
  run_status text,
  run_summary jsonb,
  failure_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if run_status not in ('completed', 'failed') then
    raise exception 'Crawler run status must be completed or failed.';
  end if;

  update public.crawler_runs
  set
    status = run_status,
    scanned_count = coalesce((run_summary ->> 'scanned_count')::integer, 0),
    candidate_count = coalesce((run_summary ->> 'candidate_count')::integer, 0),
    active_count = coalesce((run_summary ->> 'active_count')::integer, 0),
    inserted_count = coalesce((run_summary ->> 'inserted_count')::integer, 0),
    refreshed_count = coalesce((run_summary ->> 'refreshed_count')::integer, 0),
    changed_count = coalesce((run_summary ->> 'changed_count')::integer, 0),
    auto_published_count = coalesce(
      (run_summary ->> 'auto_published_count')::integer,
      0
    ),
    source_results = coalesce(run_summary -> 'source_results', '[]'::jsonb),
    error_message = failure_message,
    finished_at = now()
  where id = run_id;

  if not found then
    raise exception 'Crawler run % was not found.', run_id;
  end if;
end;
$$;

revoke all on function public.start_crawler_run(text)
from public, anon, authenticated;

revoke all on function public.finish_crawler_run(uuid, text, jsonb, text)
from public, anon, authenticated;

grant execute on function public.start_crawler_run(text)
to service_role;

grant execute on function public.finish_crawler_run(uuid, text, jsonb, text)
to service_role;
