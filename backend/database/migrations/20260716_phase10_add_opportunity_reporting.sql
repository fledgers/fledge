create table if not exists public.opportunity_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'incorrect_information',
      'already_expired',
      'suspicious_or_scam',
      'broken_application_link',
      'duplicate',
      'other'
    )
  ),
  details text check (
    details is null or char_length(btrim(details)) between 1 and 1000
  ),
  status text not null default 'pending' check (
    status in ('pending', 'reviewing', 'resolved', 'dismissed')
  ),
  resolution_notes text check (
    resolution_notes is null or char_length(btrim(resolution_notes)) between 1 and 1000
  ),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint opportunity_reports_other_details_required check (
    reason <> 'other' or details is not null
  )
);

alter table public.opportunity_reports enable row level security;

drop policy if exists "Users can view their own opportunity reports"
on public.opportunity_reports;

create policy "Users can view their own opportunity reports"
on public.opportunity_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);

drop policy if exists "Users can report visible opportunities"
on public.opportunity_reports;

create policy "Users can report visible opportunities"
on public.opportunity_reports
for insert
to authenticated
with check (
  auth.uid() = reporter_user_id
  and status = 'pending'
  and resolution_notes is null
  and resolved_at is null
  and exists (
    select 1
    from public.opportunities as opportunity
    where opportunity.id = opportunity_reports.opportunity_id
      and (
        opportunity.visibility = 'public'
        or opportunity.owner_user_id = auth.uid()
      )
  )
);

revoke all on public.opportunity_reports from anon;
grant select, insert on public.opportunity_reports to authenticated;

create index if not exists opportunity_reports_status_created_at_idx
on public.opportunity_reports(status, created_at);

create index if not exists opportunity_reports_opportunity_id_idx
on public.opportunity_reports(opportunity_id);

create unique index if not exists opportunity_reports_one_pending_per_user_idx
on public.opportunity_reports(opportunity_id, reporter_user_id)
where status in ('pending', 'reviewing');
