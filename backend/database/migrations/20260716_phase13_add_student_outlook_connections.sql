create extension if not exists supabase_vault with schema vault;

alter table public.profiles
  add column if not exists outlook_onboarding_status text not null default 'not_asked',
  add column if not exists outlook_onboarding_updated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_outlook_onboarding_status_check;

alter table public.profiles
  add constraint profiles_outlook_onboarding_status_check
  check (
    outlook_onboarding_status in (
      'not_asked',
      'declined',
      'connected',
      'disconnected'
    )
  );

create table if not exists public.outlook_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_secret_id uuid,
  microsoft_account_id text,
  microsoft_email text,
  microsoft_display_name text,
  granted_scopes text[] not null default '{}',
  status text not null default 'connected' check (
    status in ('connected', 'error', 'disconnected')
  ),
  connected_at timestamptz not null default now(),
  last_crawled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outlook_connections_connected_token_check check (
    (status in ('connected', 'error') and refresh_token_secret_id is not null)
    or (status = 'disconnected' and refresh_token_secret_id is null)
  )
);

alter table public.outlook_connections
  drop constraint if exists outlook_connections_connected_token_check;

alter table public.outlook_connections
  add constraint outlook_connections_connected_token_check check (
    (status in ('connected', 'error') and refresh_token_secret_id is not null)
    or (status = 'disconnected' and refresh_token_secret_id is null)
  );

create table if not exists public.outlook_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint outlook_oauth_states_hash_check check (
    state_hash ~ '^[0-9a-f]{64}$'
  )
);

alter table public.outlook_connections enable row level security;
alter table public.outlook_oauth_states enable row level security;

-- Outlook tokens and OAuth state are backend-only. Status is returned through
-- authenticated Edge Functions rather than direct table policies.
revoke all on public.outlook_connections from public, anon, authenticated;
revoke all on public.outlook_oauth_states from public, anon, authenticated;

create index if not exists outlook_connections_status_idx
on public.outlook_connections(status);

create index if not exists outlook_connections_last_crawled_at_idx
on public.outlook_connections(last_crawled_at);

create unique index if not exists outlook_connections_active_microsoft_account_idx
on public.outlook_connections(microsoft_account_id)
where microsoft_account_id is not null
  and status in ('connected', 'error');

create index if not exists outlook_oauth_states_user_id_idx
on public.outlook_oauth_states(user_id);

create index if not exists outlook_oauth_states_expires_at_idx
on public.outlook_oauth_states(expires_at);

create or replace function public.store_outlook_connection(
  connection_user_id uuid,
  account_id text,
  account_email text,
  account_display_name text,
  connection_scopes text[],
  refresh_token text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  existing_secret_id uuid;
  stored_secret_id uuid;
begin
  if connection_user_id is null then
    raise exception 'connection_user_id is required.';
  end if;

  if nullif(btrim(refresh_token), '') is null then
    raise exception 'A Microsoft refresh token is required.';
  end if;

  select refresh_token_secret_id
  into existing_secret_id
  from public.outlook_connections
  where user_id = connection_user_id
  for update;

  if existing_secret_id is null then
    select vault.create_secret(
      refresh_token,
      'outlook_refresh_' || replace(connection_user_id::text, '-', ''),
      'Microsoft Outlook refresh token for one Fledge user'
    )
    into stored_secret_id;
  else
    perform vault.update_secret(existing_secret_id, refresh_token);
    stored_secret_id := existing_secret_id;
  end if;

  insert into public.outlook_connections (
    user_id,
    refresh_token_secret_id,
    microsoft_account_id,
    microsoft_email,
    microsoft_display_name,
    granted_scopes,
    status,
    connected_at,
    last_error,
    updated_at
  )
  values (
    connection_user_id,
    stored_secret_id,
    nullif(account_id, ''),
    nullif(account_email, ''),
    nullif(account_display_name, ''),
    coalesce(connection_scopes, '{}'::text[]),
    'connected',
    now(),
    null,
    now()
  )
  on conflict (user_id) do update
  set
    refresh_token_secret_id = excluded.refresh_token_secret_id,
    microsoft_account_id = excluded.microsoft_account_id,
    microsoft_email = excluded.microsoft_email,
    microsoft_display_name = excluded.microsoft_display_name,
    granted_scopes = excluded.granted_scopes,
    status = 'connected',
    connected_at = now(),
    last_error = null,
    updated_at = now();

  update public.profiles
  set
    outlook_onboarding_status = 'connected',
    outlook_onboarding_updated_at = now()
  where id = connection_user_id;
end;
$$;

create or replace function public.list_outlook_connections_for_crawler()
returns table (
  user_id uuid,
  microsoft_account_id text,
  microsoft_email text,
  refresh_token text,
  last_crawled_at timestamptz
)
language sql
security definer
set search_path = public, vault
as $$
  select
    connection.user_id,
    connection.microsoft_account_id,
    connection.microsoft_email,
    secret.decrypted_secret,
    connection.last_crawled_at
  from public.outlook_connections as connection
  join vault.decrypted_secrets as secret
    on secret.id = connection.refresh_token_secret_id
  where connection.status in ('connected', 'error')
    and nullif(secret.decrypted_secret, '') is not null
  order by connection.last_crawled_at nulls first, connection.connected_at;
$$;

create or replace function public.record_outlook_crawl_result(
  connection_user_id uuid,
  replacement_refresh_token text,
  crawl_error text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  stored_secret_id uuid;
  connection_status text;
begin
  select refresh_token_secret_id, status
  into stored_secret_id, connection_status
  from public.outlook_connections
  where user_id = connection_user_id
  for update;

  if not found then
    raise exception 'Outlook connection for user % was not found.', connection_user_id;
  end if;

  -- A disconnect may happen while the crawler is using an access token. Once
  -- disconnect wins the row lock, a late crawler result must not reconnect it.
  if connection_status = 'disconnected' then
    return;
  end if;

  if nullif(replacement_refresh_token, '') is not null then
    perform vault.update_secret(stored_secret_id, replacement_refresh_token);
  end if;

  update public.outlook_connections
  set
    status = case when crawl_error is null then 'connected' else 'error' end,
    last_crawled_at = case when crawl_error is null then now() else last_crawled_at end,
    last_error = nullif(left(crawl_error, 1000), ''),
    updated_at = now()
  where user_id = connection_user_id;
end;
$$;

create or replace function public.guard_outlook_candidate_connection()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mailbox_owner_text text;
  mailbox_owner_id uuid;
begin
  if new.source_type <> 'outlook_email' then
    return new;
  end if;

  mailbox_owner_text := nullif(
    new.extracted_opportunity ->> 'mailbox_owner_user_id',
    ''
  );

  if mailbox_owner_text is null
    or mailbox_owner_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  mailbox_owner_id := mailbox_owner_text::uuid;

  if not exists (
    select 1
    from public.outlook_connections as connection
    where connection.user_id = mailbox_owner_id
      and connection.status in ('connected', 'error')
      and connection.refresh_token_secret_id is not null
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists opportunity_candidate_connection_guard_trigger
on public.opportunity_candidates;

create trigger opportunity_candidate_connection_guard_trigger
before insert or update of source_type, extracted_opportunity
on public.opportunity_candidates
for each row
execute function public.guard_outlook_candidate_connection();

create or replace function public.disconnect_outlook_connection(
  connection_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  stored_secret_id uuid;
begin
  select refresh_token_secret_id
  into stored_secret_id
  from public.outlook_connections
  where user_id = connection_user_id
  for update;

  if stored_secret_id is not null then
    delete from vault.secrets where id = stored_secret_id;
  end if;

  update public.outlook_connections
  set
    refresh_token_secret_id = null,
    status = 'disconnected',
    last_error = null,
    updated_at = now()
  where user_id = connection_user_id;

  delete from public.opportunities
  where visibility = 'private'
    and owner_user_id = connection_user_id;

  delete from public.opportunity_candidates
  where visibility = 'private'
    and owner_user_id = connection_user_id;

  delete from public.outlook_oauth_states
  where user_id = connection_user_id;

  update public.profiles
  set
    outlook_onboarding_status = 'disconnected',
    outlook_onboarding_updated_at = now()
  where id = connection_user_id;
end;
$$;

revoke all on function public.store_outlook_connection(
  uuid,
  text,
  text,
  text,
  text[],
  text
) from public, anon, authenticated;

revoke all on function public.list_outlook_connections_for_crawler()
from public, anon, authenticated;

revoke all on function public.record_outlook_crawl_result(uuid, text, text)
from public, anon, authenticated;

revoke all on function public.guard_outlook_candidate_connection()
from public, anon, authenticated;

revoke all on function public.disconnect_outlook_connection(uuid)
from public, anon, authenticated;

grant execute on function public.store_outlook_connection(
  uuid,
  text,
  text,
  text,
  text[],
  text
) to service_role;

grant execute on function public.list_outlook_connections_for_crawler()
to service_role;

grant execute on function public.record_outlook_crawl_result(uuid, text, text)
to service_role;

grant execute on function public.disconnect_outlook_connection(uuid)
to service_role;

delete from public.outlook_oauth_states
where expires_at < now();
